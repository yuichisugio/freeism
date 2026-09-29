import {
  DPoP,
  PrivateKeyJwt,
  ResponseBodyError,
  WWWAuthenticateChallengeError,
  allowInsecureRequests,
  authorizationCodeGrantRequest,
  clientCredentialsGrantRequest,
  customFetch,
  getValidatedIdTokenClaims,
  introspectionRequest,
  isDPoPNonceError,
  modifyAssertion,
  processAuthorizationCodeResponse,
  processClientCredentialsResponse,
  processIntrospectionResponse,
  processRefreshTokenResponse,
  processRevocationResponse,
  protectedResourceRequest,
  refreshTokenGrantRequest,
  revocationRequest,
  validateAuthResponse,
  validateApplicationLevelSignature,
  type AuthorizationServer,
  type Client,
  type DPoPHandle,
  type IntrospectionResponse,
  type TokenEndpointResponse,
} from "oauth4webapi";

import type { PointsOAuthTokenSet } from "./points-token-store";

const M2M_SCOPES = new Set([
  "points.connection.link-attempt.create",
  "points.connection.link-attempt.finalize",
  "points.packages.auction-eligibility",
  "points.reservations.capture",
  "points.reservations.release",
  "points.reservations.status",
]);

export interface PointsOAuthClientConfig {
  origin: string;
  issuer: string;
  resource: string;
  clientId: string;
  signingKeyJwk: string;
  dpopKeyJwk: string;
  metadata: AuthorizationServer;
  fetch: typeof globalThis.fetch;
}

export class PointsOAuthTokenEndpointError extends Error {
  constructor(
    readonly status: number,
    readonly oauthError?: string,
  ) {
    super("POINTS_TOKEN_REQUEST_FAILED");
  }
}

export interface IntrospectedUserToken extends PointsOAuthTokenSet {
  clientId: string;
  issuer: string;
  subject: string;
}

function scopes(scope: string | undefined) {
  return [...new Set(scope?.split(" ").filter(Boolean) ?? [])].sort();
}

function assertScopes(actual: string | undefined, required: readonly string[]) {
  const present = scopes(actual);
  if (required.some((scope) => !present.includes(scope))) throw new Error("POINTS_SCOPE_MISMATCH");
  return present;
}

function includesAudience(actual: string | string[] | undefined, expected: string) {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

async function importEd25519KeyPair(serialized: string) {
  const privateJwk = JSON.parse(serialized) as JsonWebKey & { kid?: string };
  if (
    privateJwk.kty !== "OKP" ||
    privateJwk.crv !== "Ed25519" ||
    !privateJwk.d ||
    !privateJwk.x ||
    !privateJwk.kid
  ) {
    throw new Error("POINTS_CLIENT_PRIVATE_KEY_INVALID");
  }
  const publicJwk = { ...privateJwk };
  delete publicJwk.d;
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, "Ed25519", false, ["sign"]);
  const publicKey = await crypto.subtle.importKey("jwk", publicJwk, "Ed25519", true, ["verify"]);
  return { privateKey, publicKey, kid: privateJwk.kid };
}

/** OAuth、introspection、資源APIで同じ接続先とDPoP鍵を使用する。 */
export class PointsOAuthClient {
  private readonly client: Client;
  private readonly keys: Promise<{
    signing: Awaited<ReturnType<typeof importEd25519KeyPair>>;
    dpop: Awaited<ReturnType<typeof importEd25519KeyPair>>;
  }>;
  private readonly dpop: Promise<DPoPHandle>;

  constructor(private readonly config: PointsOAuthClientConfig) {
    if (
      !config.clientId ||
      !config.signingKeyJwk ||
      !config.dpopKeyJwk ||
      config.metadata.issuer !== config.issuer
    ) {
      throw new Error("POINTS_OAUTH_CLIENT_MISSING");
    }
    this.client = { client_id: config.clientId, id_token_signed_response_alg: "EdDSA" };
    this.keys = Promise.all([
      importEd25519KeyPair(config.signingKeyJwk),
      importEd25519KeyPair(config.dpopKeyJwk),
    ]).then(([signing, dpop]) => ({ signing, dpop }));
    this.dpop = this.keys.then(({ dpop }) =>
      DPoP({}, dpop, {
        [modifyAssertion]: (header) => {
          header.alg = "EdDSA";
        },
      }),
    );
  }

  private async options() {
    return {
      DPoP: await this.dpop,
      [customFetch]: this.config.fetch,
      [allowInsecureRequests]: this.config.origin.startsWith("http://"),
    };
  }

  private async authentication() {
    const { signing } = await this.keys;
    return PrivateKeyJwt(
      { key: signing.privateKey, kid: signing.kid },
      {
        [modifyAssertion]: (header, payload) => {
          header.alg = "EdDSA";
          header.typ = "JWT";
          payload.aud = this.config.metadata.token_endpoint;
        },
      },
    );
  }

  private async withNonceRetry<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!isDPoPNonceError(error)) throw error;
      return run();
    }
  }

  authorizationUrl(input: {
    callbackUri: string;
    nonce: string;
    pkceChallenge: string;
    scopes: readonly string[];
    state: string;
  }) {
    const endpoint = this.config.metadata.authorization_endpoint;
    if (!endpoint) throw new Error("POINTS_AUTHORIZATION_ENDPOINT_MISSING");
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      code_challenge: input.pkceChallenge,
      code_challenge_method: "S256",
      nonce: input.nonce,
      redirect_uri: input.callbackUri,
      resource: this.config.resource,
      response_type: "code",
      scope: input.scopes.join(" "),
      state: input.state,
    }).toString();
    return url.toString();
  }

  private async authorizationCode(input: {
    callbackUri: string;
    code: string;
    issuer?: string;
    pkceVerifier: string;
    requiredScopes: readonly string[];
    nonce?: string;
    state?: string;
  }) {
    const parameters = new URLSearchParams({
      code: input.code,
      iss: input.issuer ?? "",
      state: input.state ?? "",
    });
    const validated = validateAuthResponse(
      this.config.metadata,
      this.client,
      parameters,
      input.state ?? "",
    );
    const token = await this.withNonceRetry(async () => {
      const response = await authorizationCodeGrantRequest(
        this.config.metadata,
        this.client,
        await this.authentication(),
        validated,
        input.callbackUri,
        input.pkceVerifier,
        { ...(await this.options()), additionalParameters: { resource: this.config.resource } },
      );
      const processed = await processAuthorizationCodeResponse(
        this.config.metadata,
        this.client,
        response,
        input.nonce ? { expectedNonce: input.nonce, requireIdToken: true } : undefined,
      );
      await validateApplicationLevelSignature(this.config.metadata, response, await this.options());
      return processed;
    });
    this.assertToken(token);
    const identity = await this.introspect(token.access_token);
    const idTokenClaims = getValidatedIdTokenClaims(token);
    if (
      !idTokenClaims ||
      idTokenClaims.iss !== this.config.issuer ||
      idTokenClaims.sub !== identity.sub
    ) {
      throw new Error("POINTS_OAUTH_IDENTITY_MISMATCH");
    }
    const grantedScopes = this.assertUserIntrospection(identity, input.requiredScopes);
    return { token, identity, grantedScopes };
  }

  async exchangeAuthorizationCode(input: {
    callbackUri: string;
    code: string;
    issuer?: string;
    pkceVerifier: string;
    requiredScopes: readonly string[];
    nonce?: string;
    state?: string;
  }): Promise<IntrospectedUserToken> {
    const { token, identity, grantedScopes } = await this.authorizationCode(input);
    if (!token.refresh_token) throw new Error("POINTS_REFRESH_TOKEN_MISSING");
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in! * 1000),
      clientId: this.config.clientId,
      issuer: identity.iss!,
      refreshToken: token.refresh_token,
      ...(typeof token.refresh_token_expires_in === "number"
        ? { refreshTokenExpiresAt: new Date(Date.now() + token.refresh_token_expires_in * 1000) }
        : {}),
      scopes: grantedScopes,
      subject: identity.sub!,
    };
  }

  async exchangeOneTimeAuthorizationCode(input: {
    callbackUri: string;
    code: string;
    issuer?: string;
    pkceVerifier: string;
    requiredScopes: readonly string[];
    nonce?: string;
    state?: string;
  }) {
    const { token, identity, grantedScopes } = await this.authorizationCode(input);
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in! * 1000),
      clientId: this.config.clientId,
      issuer: identity.iss!,
      scopes: grantedScopes,
      subject: identity.sub!,
    };
  }

  async getM2MAccessToken(requestedScopes: readonly string[]) {
    if (!requestedScopes.length || requestedScopes.some((scope) => !M2M_SCOPES.has(scope)))
      throw new Error("POINTS_M2M_SCOPE_INVALID");
    const token = await this.withNonceRetry(async () => {
      const response = await clientCredentialsGrantRequest(
        this.config.metadata,
        this.client,
        await this.authentication(),
        { scope: requestedScopes.join(" "), resource: this.config.resource },
        await this.options(),
      );
      return processClientCredentialsResponse(this.config.metadata, this.client, response);
    });
    this.assertToken(token);
    const identity = await this.introspect(token.access_token);
    if (
      !identity.active ||
      identity.iss !== this.config.issuer ||
      identity.client_id !== this.config.clientId ||
      identity.sub !== this.config.clientId ||
      !includesAudience(identity.aud, this.config.resource) ||
      !identity.exp ||
      identity.exp * 1000 <= Date.now()
    ) {
      throw new Error("POINTS_M2M_INTROSPECTION_INVALID");
    }
    assertScopes(identity.scope, requestedScopes);
    return token.access_token;
  }

  async refreshUserToken(refreshToken: string, requiredScopes: readonly string[]) {
    const token = await this.withNonceRetry(async () => {
      const response = await refreshTokenGrantRequest(
        this.config.metadata,
        this.client,
        await this.authentication(),
        refreshToken,
        { ...(await this.options()), additionalParameters: { resource: this.config.resource } },
      );
      return processRefreshTokenResponse(this.config.metadata, this.client, response);
    }).catch((error: unknown) => {
      if (error instanceof ResponseBodyError)
        throw new PointsOAuthTokenEndpointError(error.status, error.error);
      throw error;
    });
    this.assertToken(token);
    if (!token.refresh_token) throw new Error("POINTS_REFRESH_TOKEN_MISSING");
    const identity = await this.introspect(token.access_token);
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(Date.now() + token.expires_in! * 1000),
      refreshToken: token.refresh_token,
      ...(typeof token.refresh_token_expires_in === "number"
        ? { refreshTokenExpiresAt: new Date(Date.now() + token.refresh_token_expires_in * 1000) }
        : {}),
      scopes: this.assertUserIntrospection(identity, requiredScopes),
    } satisfies PointsOAuthTokenSet;
  }

  async introspectUserAccessToken(accessToken: string, requiredScopes: readonly string[]) {
    const identity = await this.introspect(accessToken);
    return {
      clientId: identity.client_id!,
      issuer: identity.iss!,
      scopes: this.assertUserIntrospection(identity, requiredScopes),
      subject: identity.sub!,
    };
  }

  async revoke(token: string, hint: "access_token" | "refresh_token") {
    const response = await revocationRequest(
      this.config.metadata,
      this.client,
      await this.authentication(),
      token,
      {
        additionalParameters: { token_type_hint: hint },
        [customFetch]: this.config.fetch,
        [allowInsecureRequests]: this.config.origin.startsWith("http://"),
      },
    );
    await processRevocationResponse(response);
  }

  async protectedResourceRequest(request: Request, accessToken: string) {
    const body = request.body ? await request.text() : undefined;
    const headers = new Headers(request.headers);
    headers.delete("Authorization");
    return this.withNonceRetry(async () => {
      try {
        const response = await protectedResourceRequest(
          accessToken,
          request.method,
          new URL(request.url),
          headers,
          body,
          {
            DPoP: await this.dpop,
            [customFetch]: this.config.fetch as unknown as NonNullable<
              Parameters<typeof protectedResourceRequest>[5]
            >[typeof customFetch],
            [allowInsecureRequests]: this.config.origin.startsWith("http://"),
          },
        );
        if (response.status >= 300 && response.status < 400 && response.status !== 304) {
          throw new Error("POINTS_API_REDIRECT_FORBIDDEN");
        }
        return response;
      } catch (error) {
        if (isDPoPNonceError(error)) throw error;
        if (error instanceof WWWAuthenticateChallengeError) return error.response;
        throw error;
      }
    });
  }

  private assertToken(
    token: TokenEndpointResponse,
  ): asserts token is TokenEndpointResponse & { expires_in: number } {
    if (
      token.token_type.toLowerCase() !== "dpop" ||
      !Number.isSafeInteger(token.expires_in) ||
      !token.expires_in ||
      token.expires_in <= 0
    ) {
      throw new Error("POINTS_TOKEN_RESPONSE_INVALID");
    }
  }

  private assertUserIntrospection(
    identity: IntrospectionResponse,
    requiredScopes: readonly string[],
  ) {
    if (
      !identity.active ||
      identity.iss !== this.config.issuer ||
      identity.client_id !== this.config.clientId ||
      !identity.sub ||
      identity.sub === this.config.clientId ||
      !includesAudience(identity.aud, this.config.resource) ||
      !identity.exp ||
      identity.exp * 1000 <= Date.now()
    ) {
      throw new Error("POINTS_USER_INTROSPECTION_INVALID");
    }
    return assertScopes(identity.scope, requiredScopes);
  }

  private async introspect(token: string) {
    const response = await introspectionRequest(
      this.config.metadata,
      this.client,
      await this.authentication(),
      token,
      {
        [customFetch]: this.config.fetch,
        [allowInsecureRequests]: this.config.origin.startsWith("http://"),
      },
    );
    return processIntrospectionResponse(this.config.metadata, this.client, response);
  }
}
