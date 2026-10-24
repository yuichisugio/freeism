import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { testOrigin } from "../../../test/oauth-client-test-helpers";

describe("GET /api/v1/openapi.json", () => {
  it("認証なしで資源APIのOpenAPI文書を返す", async () => {
    const response = await exports.default.fetch(`${testOrigin}/api/v1/openapi.json`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const document = (await response.json()) as { openapi: string; servers: { url: string }[] };
    expect(document.openapi).toBe("3.2.1");
    expect(document.servers).toEqual([{ url: `${testOrigin}/api/v1` }]);
  });

  it("文書以外の資源APIの経路は、引き続きクライアント認証を求める", async () => {
    const response = await exports.default.fetch(`${testOrigin}/api/v1/external-accounts`, {
      method: "QUERY",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountsUserId: "ausr_x" }),
    });

    expect(response.status).toBe(401);
  });
});
