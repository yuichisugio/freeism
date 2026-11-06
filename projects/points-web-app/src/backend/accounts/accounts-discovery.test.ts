import { describe, expect, it } from "vite-plus/test";

import openIdConfiguration from "../../../test/fixtures/accounts/openid-configuration.json";
import protectedResource from "../../../test/fixtures/accounts/oauth-protected-resource.json";
import { createFakeAccounts } from "../../../test/support/fake-accounts";
import { discoverAccounts } from "./accounts-discovery";

async function setUp() {
  const accounts = await createFakeAccounts();
  return { accounts, endpoint: { accountsOrigin: accounts.origin, fetch: accounts.fetch } };
}

describe("discoverAccounts", () => {
  it("3つのメタデータを取得し、認可サーバーのメタデータを返す", async () => {
    const { accounts, endpoint } = await setUp();

    const authorizationServer = await discoverAccounts(endpoint);

    expect(authorizationServer).toMatchObject({
      issuer: accounts.origin,
      authorization_endpoint: `${accounts.origin}/api/auth/oauth2/authorize`,
      token_endpoint: `${accounts.origin}/api/auth/oauth2/token`,
      jwks_uri: `${accounts.origin}/api/auth/jwks`,
    });
    expect(
      accounts.requests.map(({ method, url }) => `${method} ${new URL(url).pathname}`).sort(),
    ).toEqual([
      "GET /.well-known/oauth-authorization-server",
      "GET /.well-known/oauth-protected-resource/api/v1",
      "GET /.well-known/openid-configuration",
    ]);
  });

  it.each([
    ["issuerの不一致", { issuer: "https://other.example.test" }],
    ["別originのtoken endpoint", { token_endpoint: "https://other.example.test/token" }],
    [
      "別originのauthorization endpoint",
      { authorization_endpoint: "https://other.example.test/authorize" },
    ],
    ["別originのjwks_uri", { jwks_uri: "https://other.example.test/jwks" }],
    ["private_key_jwtの非対応", { token_endpoint_auth_methods_supported: ["client_secret_basic"] }],
    [
      "client assertionのEdDSA非対応",
      { token_endpoint_auth_signing_alg_values_supported: ["ES256"] },
    ],
    ["DPoPのEdDSA非対応", { dpop_signing_alg_values_supported: ["ES256"] }],
    ["ID TokenのEdDSA非対応", { id_token_signing_alg_values_supported: ["RS256"] }],
    ["S256の非対応", { code_challenge_methods_supported: ["plain"] }],
    ["identities:readの非対応", { scopes_supported: ["openid"] }],
    ["認可応答のiss非対応", { authorization_response_iss_parameter_supported: false }],
  ])("OpenID Providerメタデータの%sをDISCOVERY_INVALIDにする", async (_, override) => {
    const { accounts, endpoint } = await setUp();
    accounts.interceptNext(
      "/.well-known/openid-configuration",
      Response.json({ ...openIdConfiguration, ...override }),
    );

    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "DISCOVERY_INVALID" });
  });

  it("OAuth認可サーバーメタデータのissuer・endpointの不一致をDISCOVERY_INVALIDにする", async () => {
    const { accounts, endpoint } = await setUp();
    accounts.interceptNext(
      "/.well-known/oauth-authorization-server",
      Response.json({ ...openIdConfiguration, token_endpoint: `${accounts.origin}/other-token` }),
    );

    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "DISCOVERY_INVALID" });
  });

  it.each([
    ["resourceの不一致", { resource: "https://accounts.example.test/api/v2" }],
    ["認可サーバーの不一致", { authorization_servers: ["https://other.example.test"] }],
    ["identities:readの非対応", { scopes_supported: [] }],
    ["DPoP必須でない", { dpop_bound_access_tokens_required: false }],
    ["DPoPのEdDSA非対応", { dpop_signing_alg_values_supported: ["ES256"] }],
  ])("資源APIメタデータの%sをDISCOVERY_INVALIDにする", async (_, override) => {
    const { accounts, endpoint } = await setUp();
    accounts.interceptNext(
      "/.well-known/oauth-protected-resource/api/v1",
      Response.json({ ...protectedResource, ...override }),
    );

    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "DISCOVERY_INVALID" });
  });

  it("404・JSONでない応答をDISCOVERY_INVALID、5xxをUNAVAILABLE、通信失敗をNETWORK_ERRORにする", async () => {
    const { accounts, endpoint } = await setUp();

    accounts.interceptNext(
      "/.well-known/openid-configuration",
      new Response("Not Found", { status: 404 }),
    );
    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "DISCOVERY_INVALID" });
    accounts.interceptNext(
      "/.well-known/openid-configuration",
      new Response("<html>", { status: 200 }),
    );
    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "DISCOVERY_INVALID" });
    accounts.interceptNext(
      "/.well-known/openid-configuration",
      new Response(null, { status: 503 }),
    );
    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    accounts.interceptNext("/.well-known/openid-configuration", "network");
    await expect(discoverAccounts(endpoint)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});
