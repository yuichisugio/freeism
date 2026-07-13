import assert from "node:assert/strict";
import { test } from "node:test";

test("migration番号は0000から欠番なく並ぶ", async () => {
  const { assertMigrationSequence } = await import("../../scripts/verify-empty-d1.mjs");

  assert.deepEqual(
    assertMigrationSequence(["0001_points.sql", "0000_auth.sql", "0002_markets.sql"]),
    ["0000_auth.sql", "0001_points.sql", "0002_markets.sql"],
  );
  assert.throws(
    () => assertMigrationSequence(["0000_auth.sql", "0002_markets.sql"]),
    /missing migration 0001/,
  );
  assert.throws(
    () => assertMigrationSequence(["0000_auth.sql", "0000_other.sql"]),
    /duplicate migration 0000/,
  );
});

test("empty D1の必須schemaとlegacy Listing不在を検査する", async () => {
  const { assertRequiredSchema } = await import("../../scripts/verify-empty-d1.mjs");
  const rows = [
    ["table", "auctions"],
    ["table", "auction_revisions"],
    ["table", "bid_events"],
    ["table", "settlements"],
    ["table", "settlement_outbox"],
    ["table", "proofs"],
    ["table", "proof_review_revisions"],
    ["table", "watchlist_entries"],
    ["table", "ops_alerts"],
    ["trigger", "audit_events_append_only_update"],
  ].map(([type, name]) => ({ type, name }));

  assert.doesNotThrow(() => assertRequiredSchema(rows));
  assert.throws(
    () => assertRequiredSchema([...rows, { type: "table", name: "listings" }]),
    /legacy Listing table/,
  );
});

test("runtime sourceの禁止importとSSEを検出する", async () => {
  const { inspectRuntimeSourceEntries } =
    await import("../../scripts/verify-runtime-boundaries.mjs");

  assert.deepEqual(
    inspectRuntimeSourceEntries([
      { file: "src/server.ts", source: 'import next from "next";\nnew EventSource("/events")' },
      { file: "worker/index.ts", source: 'import { Hono } from "hono"' },
    ]),
    [
      { file: "src/server.ts", reference: "next" },
      { file: "src/server.ts", reference: "EventSource" },
    ],
  );
});

test("Better Authはstaging RCを許可しproduction RCを拒否する", async () => {
  const { assertBetterAuthRelease } = await import("../../scripts/verify-better-auth-release.mjs");
  const rc = "1.7.0-rc.1";
  const manifests = {
    markets: {
      dependencies: { "@better-auth/drizzle-adapter": rc, "better-auth": rc },
      devDependencies: { auth: rc },
    },
    points: {
      dependencies: {
        "@better-auth/drizzle-adapter": rc,
        "@better-auth/oauth-provider": rc,
        "better-auth": rc,
      },
      devDependencies: { auth: rc },
    },
  };

  assert.equal(assertBetterAuthRelease("staging", manifests), rc);
  assert.throws(
    () => assertBetterAuthRelease("production", manifests),
    /BETTER_AUTH_FINAL_REQUIRED/,
  );
  assert.throws(
    () =>
      assertBetterAuthRelease("staging", {
        ...manifests,
        markets: {
          ...manifests.markets,
          dependencies: {
            ...manifests.markets.dependencies,
            "@better-auth/oauth-provider": rc,
          },
        },
      }),
    /Markets must not depend on @better-auth\/oauth-provider/,
  );
});

test("remote release environmentはstagingとproductionだけ", async () => {
  const { migrationCommand, releaseEnvironment } = await import("../../scripts/migrate-d1.mjs");
  const { assertDrillEnvironment } = await import("../../scripts/drill-ops-alert.mjs");

  assert.equal(releaseEnvironment("staging"), "staging");
  assert.deepEqual(migrationCommand("production"), [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--env",
    "production",
    "--config",
    "wrangler.jsonc",
  ]);
  assert.throws(() => releaseEnvironment("local"), /staging or production/);
  assert.throws(() => assertDrillEnvironment("production"), /only in staging/);
});

test("generated deploy artifactはMarketsの全release bindingを要求する", async () => {
  const { assertGeneratedConfig } = await import("../../scripts/deploy-generated.mjs");
  const config = {
    targetEnvironment: "staging",
    name: "auction-worker-staging",
    workers_dev: false,
    preview_urls: false,
    compatibility_flags: [
      "nodejs_compat",
      "assets_navigation_has_no_effect",
      "global_fetch_strictly_public",
    ],
    vars: { APP_ENV: "staging", POINTS_ISSUER: "https://staging.points.freeism.app" },
    assets: {
      directory: "../client",
      not_found_handling: "none",
      html_handling: "auto-trailing-slash",
    },
    d1_databases: [{ binding: "DB", database_id: "staging-db" }],
    durable_objects: { bindings: [{ name: "AUCTION_ROOMS", class_name: "AuctionRoom" }] },
    workflows: [{ binding: "AUCTION_SETTLEMENT", name: "auction-settlement-staging" }],
    services: [{ binding: "POINTS_SERVICE", service: "points-worker-staging" }],
    analytics_engine_datasets: [{ binding: "OPS_METRICS", dataset: "markets_ops_staging" }],
    send_email: [{ name: "OPS_ALERT_EMAIL", destination_address: "ops@example.test" }],
    triggers: { crons: ["*/5 * * * *"] },
  };

  assert.doesNotThrow(() => assertGeneratedConfig(config, "staging"));
  assert.throws(
    () => assertGeneratedConfig({ ...config, services: [] }, "staging"),
    /POINTS_SERVICE/,
  );
});

test("smokeは固定originへのread-only checkだけを持つ", async () => {
  const { smokeChecks, smokeOrigin } = await import("../../scripts/smoke.mjs");

  assert.equal(smokeOrigin("production"), "https://markets.freeism.app");
  assert.ok(smokeChecks().every((check) => check.method === "GET"));
  assert.ok(smokeChecks().some((check) => check.path === "/api/health"));
  assert.ok(smokeChecks().some((check) => check.path.startsWith("/api/v1/auctions")));
});
