import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { testOrigin } from "../../../test/oauth-client-test-helpers";

function fetchWellKnown(path: string) {
  return exports.default.fetch(`${testOrigin}/.well-known/${path}`);
}

describe("/.well-known/*", () => {
  it("発行元の直下で、OpenID Providerのメタデータを返す", async () => {
    const response = await fetchWellKnown("openid-configuration");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      issuer: testOrigin,
      authorization_endpoint: `${testOrigin}/api/auth/oauth2/authorize`,
      token_endpoint: `${testOrigin}/api/auth/oauth2/token`,
      jwks_uri: `${testOrigin}/api/auth/jwks`,
      token_endpoint_auth_methods_supported: expect.arrayContaining(["private_key_jwt"]),
    });
  });

  it("OAuth認可サーバーのメタデータを返す", async () => {
    const response = await fetchWellKnown("oauth-authorization-server");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ issuer: testOrigin });
  });

  it("資源APIのメタデータで、認可サーバー・scope・DPoPの必須を示す", async () => {
    const response = await fetchWellKnown("oauth-protected-resource/api/v1");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      resource: `${testOrigin}/api/v1`,
      authorization_servers: [testOrigin],
      scopes_supported: ["identities:read"],
      dpop_bound_access_tokens_required: true,
    });
  });
});
