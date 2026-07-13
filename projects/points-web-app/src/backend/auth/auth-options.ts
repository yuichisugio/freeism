import type { BetterAuthOptions } from "better-auth";

import { pointsSocialProviderIds } from "../../shared/auth/social-providers";

export interface PointsAuthConfig {
  APP_ORIGIN: string;
  BETTER_AUTH_SECRETS: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
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
): BetterAuthOptions {
  const secure = config.APP_ORIGIN.startsWith("https://");

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
    trustedOrigins: [config.APP_ORIGIN],
  };
}
