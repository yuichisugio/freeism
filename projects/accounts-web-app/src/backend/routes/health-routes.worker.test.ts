import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("GET /healthz", () => {
  it("Workers上で稼働状態をJSONで返す", async () => {
    const response = await exports.default.fetch("https://accounts.example/healthz");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(navigator.userAgent).toBe("Cloudflare-Workers");
  });
});
