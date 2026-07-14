import { expect, test } from "@playwright/test";

import { assertGeneratedConfig, expectedWorkerName } from "../../scripts/deploy-generated";
import { migrationCommand } from "../../scripts/migrate-d1";
import { assertDrillEnvironment } from "../../scripts/drill-ops-alert";
import { smokeChecks, smokeOrigin } from "../../scripts/smoke";

test("release commands keep the Points environment and DB binding fixed", () => {
  expect(migrationCommand("staging")).toEqual([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--env",
    "staging",
    "--config",
    "wrangler.jsonc",
  ]);
  expect(expectedWorkerName("production")).toBe("points-worker-production");
  expect(() => assertDrillEnvironment("production")).toThrow(/staging/);
});

test("generated deployment config must contain the expected flattened boundaries", () => {
  expect(() =>
    assertGeneratedConfig(
      {
        targetEnvironment: "staging",
        name: "points-worker-staging",
        compatibility_flags: [
          "nodejs_compat",
          "assets_navigation_has_no_effect",
          "global_fetch_strictly_public",
        ],
        vars: { APP_ENV: "staging" },
        workers_dev: false,
        preview_urls: false,
        assets: {
          directory: "../client",
          not_found_handling: "none",
          html_handling: "auto-trailing-slash",
        },
        d1_databases: [{ binding: "DB", database_id: "real-id" }],
      },
      "staging",
    ),
  ).not.toThrow();

  expect(() =>
    assertGeneratedConfig(
      {
        targetEnvironment: "staging",
        name: "points-worker-staging",
        compatibility_flags: [
          "nodejs_compat",
          "assets_navigation_has_no_effect",
          "global_fetch_strictly_public",
        ],
        vars: { APP_ENV: "staging" },
        workers_dev: false,
        preview_urls: false,
        assets: {
          directory: "../client",
          not_found_handling: "none",
          html_handling: "auto-trailing-slash",
        },
        d1_databases: [],
      },
      "staging",
    ),
  ).toThrow(/DB/);
});

test("smoke checks are read-only and use fixed custom domains", () => {
  expect(smokeOrigin("staging")).toBe("https://staging.points.freeism.app");
  expect(smokeOrigin("production")).toBe("https://points.freeism.app");
  expect(smokeChecks()).toHaveLength(9);
  expect(smokeChecks().every((check) => check.path.startsWith("/"))).toBe(true);
  expect(smokeChecks()).toContainEqual({ path: "/search", expected: "navigation" });
});
