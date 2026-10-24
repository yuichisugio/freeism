import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const origin = "http://localhost:5173";

describe("/api/auth/*", () => {
  it("Better Authの標準エンドポイントへ接続する", async () => {
    const response = await exports.default.fetch(`${origin}/api/auth/ok`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("JWTの公開鍵をEdDSAで公開する", async () => {
    const response = await exports.default.fetch(`${origin}/api/auth/jwks`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      keys: [expect.objectContaining({ alg: "EdDSA", crv: "Ed25519" })],
    });
  });

  it.each([
    ["/api/auth/token", "GET"],
    ["/api/auth/get-access-token", "POST"],
    ["/api/auth/refresh-token", "POST"],
    ["/api/auth/account-info", "GET"],
    ["/api/auth/unlink-account", "POST"],
    ["/api/auth/update-user", "POST"],
    ["/api/auth/oauth2/register", "POST"],
    ["/api/auth/oauth2/create-client", "POST"],
    ["/api/auth/oauth2/update-client", "POST"],
    ["/api/auth/oauth2/delete-client", "POST"],
  ])("HTTPで無効にした%sは404を返す", async (path, method) => {
    const response = await exports.default.fetch(`${origin}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Origin: origin },
      body: method === "GET" ? undefined : "{}",
    });

    expect(response.status).toBe(404);
  });
});
