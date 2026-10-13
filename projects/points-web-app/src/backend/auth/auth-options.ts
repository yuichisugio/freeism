import type { BetterAuthOptions } from "better-auth";
import { jwt, oAuthProxy, testUtils } from "better-auth/plugins";

import { pointsSocialProviderIds } from "../../shared/auth/social-providers";
import { createPointsOAuthProvider } from "./points-oauth-provider";

export interface PointsAuthConfig {
  APP_ORIGIN: string;
  BETTER_AUTH_SECRETS: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OAUTH_PROXY_PRODUCTION_URL?: string;
  PREVIEW_WORKERS_SUBDOMAIN?: string;
  DB?: D1Database;
}

export const googleFreshAuthorizationParams = Object.freeze({
  claims: JSON.stringify({ id_token: { auth_time: { essential: true } } }),
});

export function parseBetterAuthSecrets(value: string): NonNullable<BetterAuthOptions["secrets"]> {
  if (value.length === 0) {
    throw new Error("BETTER_AUTH_SECRETS must contain at least one versioned secret");
  }

  const versions = new Set<number>();
  return value.split(",").map((entry) => {
    const separator = entry.indexOf(":");
    const rawVersion = separator === -1 ? "" : entry.slice(0, separator);
    const secret = separator === -1 ? "" : entry.slice(separator + 1);

    if (!/^[1-9]\d*$/.test(rawVersion) || secret.length < 32) {
      throw new Error(
        "BETTER_AUTH_SECRETS must use version:secret entries with 32+ character secrets",
      );
    }

    const version = Number(rawVersion);
    if (!Number.isSafeInteger(version) || versions.has(version)) {
      throw new Error("BETTER_AUTH_SECRETS must use unique safe-integer versions");
    }
    versions.add(version);

    return { value: secret, version };
  });
}

export function createPointsAuthOptions(
  config: PointsAuthConfig,
  database?: BetterAuthOptions["database"],
  enableTestUtils = false,
) {
  const secure = config.APP_ORIGIN.startsWith("https://");
  const productionURL = config.OAUTH_PROXY_PRODUCTION_URL || config.APP_ORIGIN;
  const previewOriginPattern = config.PREVIEW_WORKERS_SUBDOMAIN
    ? `https://points-pr-*-points-worker-staging.${config.PREVIEW_WORKERS_SUBDOMAIN}.workers.dev`
    : null;

  return {
    ...(database === undefined ? {} : { database }),
    account: {
      accountLinking: {
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        disableImplicitLinking: true,
        enabled: true,
        trustedProviders: [...pointsSocialProviderIds],
        updateUserInfoOnLink: false,
      },
      encryptOAuthTokens: true,
      storeAccountCookie: false,
      storeStateStrategy: "database",
    },
    advanced: {
      cookiePrefix: "points",
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure,
      },
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: secure,
    },
    baseURL: config.APP_ORIGIN,
    disabledPaths: [
      "/oauth2/register",
      "/oauth2/create-client",
      "/oauth2/update-client",
      "/oauth2/delete-client",
      "/oauth2/client/rotate-secret",
    ],
    emailAndPassword: { enabled: false },
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    secrets: parseBetterAuthSecrets(config.BETTER_AUTH_SECRETS),
    socialProviders: {
      github: {
        clientId: config.GITHUB_CLIENT_ID,
        clientSecret: config.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
      },
    },
    plugins: [
      oAuthProxy({ productionURL }),
      jwt({
        disableSettingJwtHeader: true,
        jwt: { issuer: config.APP_ORIGIN },
        jwks: { keyPairConfig: { alg: "EdDSA" } },
      }),
      createPointsOAuthProvider(config),
      ...(enableTestUtils ? [testUtils()] : []),
    ],
    trustedOrigins: [
      config.APP_ORIGIN,
      productionURL,
      ...(previewOriginPattern === null ? [] : [previewOriginPattern]),
    ],
  } satisfies BetterAuthOptions;
}
