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
    "/api/auth/token",
    "/api/auth/unlink-account",
    "/api/auth/update-user",
    "/api/auth/oauth2/create-client",
  ])("HTTPで無効にした%sは404を返す", async (path) => {
    const response = await exports.default.fetch(`${origin}${path}`, {
      method: path === "/api/auth/token" ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: path === "/api/auth/token" ? undefined : "{}",
    });

    expect(response.status).toBe(404);
  });
});
