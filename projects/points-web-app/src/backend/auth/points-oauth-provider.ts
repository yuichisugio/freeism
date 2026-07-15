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
  SETTLEMENT: ["points.admin.settlement.retry"],
} as const;

export const pointsOAuthClients = {
  USER: {
    grantTypes: ["authorization_code", "refresh_token"] as const,
    requirePKCE: true,
    scopes: pointsOAuthScopes.USER,
    subjectType: "pairwise" as const,
  },
  M2M: {
    grantTypes: ["client_credentials"] as const,
    requirePKCE: false,
    scopes: pointsOAuthScopes.M2M,
  },
  SETTLEMENT: {
    grantTypes: ["authorization_code"] as const,
    requirePKCE: true,
    scopes: pointsOAuthScopes.SETTLEMENT,
    subjectType: "pairwise" as const,
  },
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

export function createPointsOAuthProvider(config: {
  APP_ORIGIN: string;
  DB?: D1Database;
  MARKETS_SETTLEMENT_RETRY_RESOURCE: string;
  POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN?: string;
  POINTS_OAUTH_PAIRWISE_SECRET: string;
}) {
  const bootstrapToken = config.POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN?.trim();
  return oauthProvider({
    allowDynamicClientRegistration: bootstrapToken !== undefined && bootstrapToken.length > 0,
    clientRegistrationAllowedScopes: [
      ...pointsOAuthScopes.USER,
      ...pointsOAuthScopes.M2M,
      ...pointsOAuthScopes.SETTLEMENT,
    ],
    consentPage: "/oauth/consent",
    disableJwtPlugin: true,
    grantTypes: ["authorization_code", "refresh_token", "client_credentials"],
    loginPage: "/login",
    pairwiseSecret: config.POINTS_OAUTH_PAIRWISE_SECRET,
    resources: [
      {
        allowedScopes: [...pointsOAuthScopes.USER, ...pointsOAuthScopes.M2M],
        identifier: `${config.APP_ORIGIN}/api/v1`,
        name: "Points Resource API",
      },
      {
        allowedScopes: [...pointsOAuthScopes.SETTLEMENT],
        identifier: config.MARKETS_SETTLEMENT_RETRY_RESOURCE,
        name: "Markets Settlement Retry",
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
    scopes: [...pointsOAuthScopes.USER, ...pointsOAuthScopes.M2M, ...pointsOAuthScopes.SETTLEMENT],
    ...(bootstrapToken === undefined || bootstrapToken.length === 0
      ? {}
      : {
          validateInitialAccessToken: async ({ initialAccessToken }) =>
            (await constantTimeEqual(initialAccessToken, bootstrapToken)) ? {} : false,
        }),
  });
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encode = (value: string) => new TextEncoder().encode(value);
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode(left)),
    crypto.subtle.digest("SHA-256", encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return difference === 0;
}
