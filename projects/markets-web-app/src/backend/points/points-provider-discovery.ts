import {
  allowInsecureRequests,
  customFetch,
  discoveryRequest,
  processDiscoveryResponse,
  processResourceDiscoveryResponse,
  resourceDiscoveryRequest,
  type AuthorizationServer,
} from "oauth4webapi";

/** Points互換提供先のOAuth・資源APIメタデータを検証する。 */
export async function discoverPointsProvider(
  origin: string,
  pointsFetch: typeof fetch = globalThis.fetch,
): Promise<AuthorizationServer> {
  const issuer = new URL(origin);
  const resource = new URL(`${origin}/api/v1`);
  const options = {
    signal: () => AbortSignal.timeout(10_000),
    [allowInsecureRequests]: issuer.protocol === "http:",
    [customFetch]: async (url: RequestInfo | URL, init?: RequestInit) => {
      const response = await pointsFetch(url, { ...init, redirect: "manual" });
      if (response.redirected || (response.status >= 300 && response.status < 400)) {
        throw new Error("POINTS_PROVIDER_DISCOVERY_REDIRECT");
      }
      return response;
    },
  };
  const [oidc, oauth2, protectedResource] = await Promise.all([
    discoveryRequest(issuer, { ...options, algorithm: "oidc" }).then((response) =>
      processDiscoveryResponse(issuer, response),
    ),
    discoveryRequest(issuer, { ...options, algorithm: "oauth2" }).then((response) =>
      processDiscoveryResponse(issuer, response),
    ),
    resourceDiscoveryRequest(resource, options).then((response) =>
      processResourceDiscoveryResponse(resource, response),
    ),
  ]);

  const includes = (items: unknown, value: string) => Array.isArray(items) && items.includes(value);
  const sameOrigin = (url: unknown) => typeof url === "string" && URL.parse(url)?.origin === origin;
  const pointsScopes = [
    "points.connection.read",
    "points.balance.read",
    "points.reservations.create",
    "points.connection.unlink",
    "points.connection.link-attempt.create",
    "points.connection.link-attempt.finalize",
    "points.packages.auction-eligibility",
    "points.reservations.status",
    "points.reservations.capture",
    "points.reservations.release",
  ];
  const endpoints = [
    "authorization_endpoint",
    "token_endpoint",
    "jwks_uri",
    "introspection_endpoint",
    "revocation_endpoint",
  ] as const;
  if (
    oidc.issuer !== origin ||
    oauth2.issuer !== origin ||
    !endpoints.every((key) => sameOrigin(oidc[key]) && oidc[key] === oauth2[key]) ||
    !includes(oidc.token_endpoint_auth_methods_supported, "private_key_jwt") ||
    !includes(oidc.token_endpoint_auth_signing_alg_values_supported, "EdDSA") ||
    !includes(oidc.dpop_signing_alg_values_supported, "EdDSA") ||
    !includes(oidc.id_token_signing_alg_values_supported, "EdDSA") ||
    !includes(oidc.code_challenge_methods_supported, "S256") ||
    !includes(oidc.scopes_supported, "openid") ||
    !["openid", "profile", "offline_access", ...pointsScopes].every((scope) =>
      includes(oidc.scopes_supported, scope),
    ) ||
    oidc.authorization_response_iss_parameter_supported !== true ||
    !includes(protectedResource.authorization_servers, origin) ||
    !pointsScopes.every((scope) => includes(protectedResource.scopes_supported, scope)) ||
    !includes(protectedResource.dpop_signing_alg_values_supported, "EdDSA") ||
    protectedResource.dpop_bound_access_tokens_required !== true
  ) {
    throw new Error("POINTS_PROVIDER_DISCOVERY_INVALID");
  }
  return oidc;
}
