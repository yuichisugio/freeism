import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vite-plus/test";

import {
  createPointsAuthOptions,
  googleFreshAuthorizationParams,
} from "../../src/backend/auth/auth-options";

const config = {
  APP_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRETS: "1:test-secret-at-least-32-characters",
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  POINTS_OAUTH_PAIRWISE_SECRET: "test-pairwise-secret-at-least-32-characters",
};

describe("Google fresh authorization parameters", () => {
  it("keeps auth_time, state, and PKCE on the built-in Google provider URL", async () => {
    const auth = betterAuth(createPointsAuthOptions(config));
    const provider = (await auth.$context).socialProviders.find(({ id }) => id === "google");

    expect(provider).toBeDefined();

    const url = await provider!.createAuthorizationURL({
      additionalParams: googleFreshAuthorizationParams,
      codeVerifier: "contract-code-verifier",
      redirectURI: `${config.APP_ORIGIN}/api/auth/callback/google`,
      state: "contract-state",
    });

    expect(JSON.parse(url.searchParams.get("claims") ?? "null")).toEqual({
      id_token: { auth_time: { essential: true } },
    });
    expect(url.searchParams.get("state")).toBe("contract-state");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.has("prompt")).toBe(false);
    expect(url.searchParams.has("max_age")).toBe(false);
  });
});
