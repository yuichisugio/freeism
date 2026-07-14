import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";

describe("staging ops alert drill", () => {
  const app = createPointsBackendApp();
  const stagingEnv = {
    ...env,
    APP_ENV: "staging",
    OPS_RESOURCE_HASH_SALT: "test-ops-hash-salt",
    POINTS_OPS_DRILL_TOKEN: "test-drill-token",
  } as Env;

  async function phase(value: string, token = "test-drill-token") {
    return app.fetch(
      new Request("https://staging.points.freeism.app/api/internal/ops-alert-drill", {
        body: JSON.stringify({ phase: value }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Correlation-Id": "drill-correlation",
        },
        method: "POST",
      }),
      stagingEnv,
    );
  }

  it("opens, deduplicates, and resolves one alert key", async () => {
    expect((await (await phase("OPEN")).json<{ status: string }>()).status).toBe("OPEN");
    const dedupe = await (
      await phase("DEDUPE")
    ).json<{
      evidence: { repeatCount: number };
      status: string;
    }>();
    expect(dedupe).toMatchObject({ evidence: { repeatCount: 2 }, status: "DEDUPE" });
    expect((await (await phase("RESOLVED")).json<{ status: string }>()).status).toBe("RESOLVED");
  });

  it("rejects a wrong token and is absent from production", async () => {
    expect((await phase("OPEN", "wrong-token")).status).toBe(401);
    const production = await app.fetch(
      new Request("https://points.freeism.app/api/internal/ops-alert-drill", { method: "POST" }),
      { ...stagingEnv, APP_ENV: "production" },
    );
    expect(production.status).toBe(404);
  });
});
