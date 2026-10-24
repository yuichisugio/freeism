import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { app } from "../app";

const credentials = { BASIC_AUTH_USERNAME: "tester", BASIC_AUTH_PASSWORD: "secret" };

describe("Basic認証", () => {
  it("資格情報を登録した環境では、画面への認証なしのアクセスを拒否する", async () => {
    const response = await app.request("/", {}, { ...env, ...credentials });

    expect(response.status).toBe(401);
  });

  it("資格情報を登録した環境でも、死活監視は認証なしで通す", async () => {
    const response = await app.request("/healthz", {}, { ...env, ...credentials });

    expect(response.status).toBe(200);
  });
});
