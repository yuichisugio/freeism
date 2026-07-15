import type { BetterAuthOptions } from "better-auth";

import { marketsSocialProviderIds } from "../../shared/auth/social-providers";

export interface MarketsAuthConfig {
  APP_ORIGIN: string;
  BETTER_AUTH_SECRETS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export function parseBetterAuthSecrets(value: string): NonNullable<BetterAuthOptions["secrets"]> {
  if (value.length === 0) throw new Error("BETTER_AUTH_SECRETS_REQUIRED");
  const versions = new Set<number>();
  return value.split(",").map((entry) => {
    const separator = entry.indexOf(":");
    const version = Number(entry.slice(0, separator));
    const secret = entry.slice(separator + 1);
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      versions.has(version) ||
      secret.length < 32
    ) {
      throw new Error("BETTER_AUTH_SECRETS_INVALID");
    }
    versions.add(version);
    return { value: secret, version };
  });
}

export function createMarketsAuthOptions(
  config: MarketsAuthConfig,
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
        trustedProviders: [...marketsSocialProviderIds],
        updateUserInfoOnLink: false,
      },
      encryptOAuthTokens: true,
      storeAccountCookie: false,
      storeStateStrategy: "database",
    },
    advanced: {
      cookiePrefix: "markets",
      defaultCookieAttributes: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure,
      },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: secure,
    },
    baseURL: config.APP_ORIGIN,
    emailAndPassword: { enabled: false },
    rateLimit: { enabled: true, storage: "database" },
    secrets: parseBetterAuthSecrets(config.BETTER_AUTH_SECRETS),
    socialProviders: {
      google: {
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: [config.APP_ORIGIN],
  };
}
