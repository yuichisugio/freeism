import { getOAuthProviderState, oauthProvider } from "@better-auth/oauth-provider";

import { bindPointsLinkAttemptFromOAuthState } from "../usecases/bind-points-link-attempt-from-oauth-state";

export const pointsOAuthScopes = {
  USER: [
    "openid",
    "profile",
    "offline_access",
    "points.connection.read",
    "points.balance.read",
    "points.reservations.create",
    "points.connection.unlink",
  ],
  M2M: [
    "points.connection.link-attempt.create",
    "points.connection.link-attempt.finalize",
    "points.packages.auction-eligibility",
    "points.reservations.status",
    "points.reservations.capture",
    "points.reservations.release",
  ],
} as const;

const linkBindingScopes = new Set([
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
]);

export function requiresPointsLinkAttemptBinding(scope: string | null): boolean {
  return (scope ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .some((value) => linkBindingScopes.has(value));
}

export function createPointsOAuthProvider(config: { APP_ORIGIN: string; DB?: D1Database }) {
  const pointsResource = `${config.APP_ORIGIN}/api/v1`;
  return oauthProvider({
    accessTokenExpiresIn: 900,
    allowDynamicClientRegistration: false,
    clientPrivileges: ({ session }) => Boolean(session),
    clientRegistrationDefaultResources: [pointsResource],
    consentPage: "/oauth/consent",
    dpop: { signingAlgorithms: ["EdDSA"] },
    grantTypes: ["authorization_code", "refresh_token", "client_credentials"],
    loginPage: "/login",
    m2mAccessTokenExpiresIn: 900,
    resources: [
      {
        allowedScopes: [...pointsOAuthScopes.USER, ...pointsOAuthScopes.M2M],
        identifier: pointsResource,
        name: "Points Resource API",
        dpopBoundAccessTokensRequired: true,
      },
    ],
    ...(config.DB === undefined
      ? {}
      : {
          postLogin: {
            consentReferenceId: async ({ user }) => {
              const state = await getOAuthProviderState();
              if (!state?.query) throw new Error("OAUTH_PROVIDER_STATE_MISSING");
              const query = new URLSearchParams(state.query);
              const rawState = query.get("state");
              const userClientId = query.get("client_id");
              if (!rawState || !userClientId) throw new Error("OAUTH_PROVIDER_STATE_MISSING");
              if (!requiresPointsLinkAttemptBinding(query.get("scope"))) {
                const digest = await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(rawState),
                );
                return `oauth_${Array.from(new Uint8Array(digest), (byte) =>
                  byte.toString(16).padStart(2, "0"),
                ).join("")}`;
              }
              return bindPointsLinkAttemptFromOAuthState(config.DB!, {
                authUserId: user.id,
                rawState,
                userClientId,
              });
            },
            page: "/oauth/consent",
            shouldRedirect: async () => false,
          },
        }),
    scopes: [...pointsOAuthScopes.USER, ...pointsOAuthScopes.M2M],
  });
}
