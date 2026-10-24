import { describe, expect, it } from "vite-plus/test";

import {
  createPointsOAuthProvider,
  pointsOAuthScopes,
  requiresPointsLinkAttemptBinding,
} from "../../src/backend/auth/points-oauth-provider";

describe("Points OAuth contract", () => {
  it("keeps USER and M2M scopes separate", () => {
    const groups = Object.values(pointsOAuthScopes).map((scopes) => new Set(scopes));
    for (let left = 0; left < groups.length; left += 1) {
      for (let right = left + 1; right < groups.length; right += 1) {
        expect([...groups[left]!].filter((scope) => groups[right]!.has(scope))).toEqual([]);
      }
    }
  });

  it("uses standard JWT OAuth Provider with a fifteen-minute lifetime", () => {
    const plugin = createPointsOAuthProvider({
      APP_ORIGIN: "https://points.example.test",
    });
    expect(plugin.id).toBe("oauth-provider");
    expect(plugin.options).toMatchObject({
      allowDynamicClientRegistration: false,
      accessTokenExpiresIn: 900,
      consentPage: "/oauth/consent",
      grantTypes: ["authorization_code", "refresh_token", "client_credentials"],
      loginPage: "/login",
      m2mAccessTokenExpiresIn: 900,
    });
  });

  it("requires a link attempt only for the initial user connection flow", () => {
    expect(
      requiresPointsLinkAttemptBinding("openid points.connection.read points.balance.read"),
    ).toBe(true);
    expect(requiresPointsLinkAttemptBinding("points.connection.unlink")).toBe(false);
  });
});
