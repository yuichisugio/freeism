import { describe, expect, it } from "vite-plus/test";

import { marketsSocialProviderIds } from "../../shared/auth/social-providers";
import { createMarketsAuthOptions } from "./auth-options";

const options = createMarketsAuthOptions({
  APP_ORIGIN: "https://markets.example.test",
  BETTER_AUTH_SECRETS:
    "2:current-secret-at-least-thirty-two-characters,1:old-secret-at-least-thirty-two-characters",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
});

describe("Markets Better Auth options", () => {
  it("offers only Google for login and linking", () => {
    expect(marketsSocialProviderIds).toEqual(["google"]);
    expect(Object.keys(options.socialProviders ?? {})).toEqual(["google"]);
  });

  it("disables implicit email linking and encrypts social tokens", () => {
    expect(options.emailAndPassword).toEqual({ enabled: false });
    expect(options.account).toMatchObject({
      accountLinking: {
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        disableImplicitLinking: true,
        trustedProviders: ["google"],
        updateUserInfoOnLink: false,
      },
      encryptOAuthTokens: true,
      storeAccountCookie: false,
      storeStateStrategy: "database",
    });
  });
});
