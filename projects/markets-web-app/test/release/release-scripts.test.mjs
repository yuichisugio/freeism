import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

function sourceReleaseConfig() {
  const environment = (name) => ({
    name: `auction-worker-${name}`,
    vars: {
      APP_ENV: name,
      POINTS_ISSUER:
        name === "production" ? "https://points.freeism.app" : "https://staging.points.freeism.app",
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: `markets-${name}`,
        database_id: `${name}-db-id`,
        migrations_dir: "drizzle",
      },
    ],
    durable_objects: { bindings: [{ name: "AUCTION_ROOMS", class_name: "AuctionRoom" }] },
    workflows: [{ binding: "AUCTION_SETTLEMENT", name: `auction-settlement-${name}` }],
    services: [{ binding: "POINTS_SERVICE", service: `points-worker-${name}` }],
    analytics_engine_datasets: [{ binding: "OPS_METRICS", dataset: `markets_ops_${name}` }],
    send_email: [{ name: "OPS_ALERT_EMAIL", destination_address: "ops@example.test" }],
    triggers: { crons: ["*/5 * * * *"] },
    routes: [
      {
        pattern: `${name === "production" ? "" : "staging."}markets.freeism.app`,
        custom_domain: true,
      },
    ],
    observability: {
      enabled: true,
      logs: { head_sampling_rate: 1 },
      traces: { enabled: true, head_sampling_rate: name === "production" ? 0.05 : 1 },
    },
  });
  return { env: { production: environment("production"), staging: environment("staging") } };
}

function lockImporter(name, version, includeProvider) {
  const provider = includeProvider
    ? `      '@better-auth/oauth-provider':\n        specifier: ${version}\n        version: ${version}(peer-hash)\n`
    : "";
  return `  projects/${name}-web-app:\n    dependencies:\n      '@better-auth/drizzle-adapter':\n        specifier: ${version}\n        version: ${version}(@better-auth/core@${version})\n${provider}      better-auth:\n        specifier: ${version}\n        version: ${version}(react@19.2.7)\n    devDependencies:\n      auth:\n        specifier: ${version}\n        version: ${version}\n`;
}

test("migration番号は0000から欠番なく並ぶ", async () => {
  const { assertMigrationJournal, assertMigrationSequence } =
    await import("../../scripts/verify-empty-d1.mjs");

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
  assert.doesNotThrow(() =>
    assertMigrationJournal(["0000_auth.sql", "0001_domain.sql"], {
      entries: [{ tag: "0000_auth" }, { tag: "0001_domain" }],
    }),
  );
  assert.throws(
    () =>
      assertMigrationJournal(["0000_auth.sql", "0001_domain.sql"], {
        entries: [{ tag: "0001_domain" }, { tag: "0000_auth" }],
      }),
    /migration journal order/,
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
    ["table", "ops_alert_cleanup_leases"],
    ["trigger", "audit_events_append_only_update"],
  ].map(([type, name]) => ({ type, name }));

  assert.doesNotThrow(() => assertRequiredSchema(rows));
  assert.throws(
    () => assertRequiredSchema([...rows, { type: "table", name: "listings" }]),
    /legacy Listing table/,
  );
});

test("empty D1の主要unique/check/append-only triggerを検査する", async () => {
  const { assertSchemaInvariants } = await import("../../scripts/verify-empty-d1.mjs");
  const rows = [
    {
      type: "table",
      name: "settlements",
      sql: "CREATE TABLE settlements (CONSTRAINT settlements_state_check CHECK (1))",
    },
    {
      type: "table",
      name: "settlement_outbox",
      sql: "CREATE TABLE settlement_outbox (CONSTRAINT settlement_outbox_status_check CHECK (1))",
    },
    {
      type: "table",
      name: "ops_alert_cleanup_leases",
      sql: "CREATE TABLE ops_alert_cleanup_leases (lease_key TEXT PRIMARY KEY, lease_expires_at TEXT)",
    },
    {
      type: "index",
      name: "settlements_source_uidx",
      sql: "CREATE UNIQUE INDEX settlements_source_uidx ON settlements (auction_id,kind,source_key)",
    },
    {
      type: "index",
      name: "settlement_outbox_attempt_uidx",
      sql: "CREATE UNIQUE INDEX settlement_outbox_attempt_uidx ON settlement_outbox (settlement_id,settlement_revision,workflow_attempt)",
    },
    ...[
      ["audit_events_append_only_update", "UPDATE"],
      ["audit_events_append_only_delete", "DELETE"],
      ["auction_revisions_append_only_update", "UPDATE"],
      ["auction_revisions_append_only_delete", "DELETE"],
      ["bid_events_append_only_update", "UPDATE"],
      ["bid_events_append_only_delete", "DELETE"],
      ["settlement_plans_append_only_update", "UPDATE"],
      ["settlement_plans_append_only_delete", "DELETE"],
    ].map(([name, operation]) => ({
      type: "trigger",
      name,
      sql: `CREATE TRIGGER ${name} BEFORE ${operation} ON target BEGIN SELECT RAISE(ABORT, 'IMMUTABLE'); END`,
    })),
  ];

  assert.doesNotThrow(() => assertSchemaInvariants(rows));
  assert.throws(
    () =>
      assertSchemaInvariants(
        rows.filter((row) => row.name !== "settlement_plans_append_only_delete"),
      ),
    /settlement_plans_append_only_delete/,
  );
  assert.throws(
    () =>
      assertSchemaInvariants(
        rows.map((row) =>
          row.name === "settlements_source_uidx"
            ? { ...row, sql: "CREATE INDEX settlements_source_uidx" }
            : row,
        ),
      ),
    /unique index settlements_source_uidx/,
  );
  assert.throws(
    () =>
      assertSchemaInvariants(
        rows.map((row) =>
          row.name === "settlements_source_uidx"
            ? { ...row, sql: row.sql.replace("auction_id,kind,source_key", "auction_id") }
            : row,
        ),
      ),
    /unique index settlements_source_uidx/,
  );
  assert.throws(
    () =>
      assertSchemaInvariants(
        rows.map((row) =>
          row.name === "audit_events_append_only_delete"
            ? { ...row, sql: row.sql.replace("BEFORE DELETE", "BEFORE UPDATE") }
            : row,
        ),
      ),
    /audit_events_append_only_delete/,
  );
});

test("runtime sourceの禁止importとSSEを検出する", async () => {
  const { inspectRuntimeSourceEntries } =
    await import("../../scripts/verify-runtime-boundaries.mjs");

  assert.deepEqual(
    inspectRuntimeSourceEntries([
      {
        file: "src/server.ts",
        source:
          'import next from "next";\nimport { headers } from "next/server";\nnew EventSource("/events")',
      },
      { file: "worker/index.ts", source: 'import { Hono } from "hono"' },
    ]),
    [
      { file: "src/server.ts", reference: "next" },
      { file: "src/server.ts", reference: "next/server" },
      { file: "src/server.ts", reference: "EventSource" },
    ],
  );
});

test("Better Auth lockfileはspecifierだけでなくresolved versionもexact一致する", async () => {
  const { assertBetterAuthLockfile } = await import("../../scripts/verify-better-auth-release.mjs");
  const version = "1.7.0";
  const valid = `${lockImporter("markets", version, false)}${lockImporter("points", version, true)}`;
  assert.doesNotThrow(() => assertBetterAuthLockfile(valid, version));
  assert.throws(
    () =>
      assertBetterAuthLockfile(
        valid.replace("version: 1.7.0(react@19.2.7)", "version: 1.6.0(react@19.2.7)"),
        version,
      ),
    /resolved version/,
  );
});

test("Better Auth正式版gateは既存contract/auth/OAuth/ADMIN回帰を順に要求する", async () => {
  const { runBetterAuthReleaseRegressions } =
    await import("../../scripts/verify-better-auth-release.mjs");
  const calls = [];
  runBetterAuthReleaseRegressions((command, args) => {
    calls.push([command, args]);
    return { status: 0 };
  });
  assert.ok(calls.length >= 5);
  assert.ok(calls.some(([, args]) => args.includes("contract:web-app:check")));
  assert.ok(calls.some(([, args]) => args.some((arg) => arg.includes("auth-google"))));
  assert.ok(calls.some(([, args]) => args.some((arg) => arg.includes("points-oauth"))));
  assert.ok(calls.some(([, args]) => args.some((arg) => arg.includes("settlement-admin"))));
  assert.throws(
    () => runBetterAuthReleaseRegressions(() => ({ status: 1 })),
    /Better Auth release regression failed/,
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
  const { migrationCommand, releaseEnvironment, releaseTargetFromConfig } =
    await import("../../scripts/migrate-d1.mjs");
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
  assert.equal(
    releaseTargetFromConfig(sourceReleaseConfig(), "production").database.id,
    "production-db-id",
  );
  const duplicate = sourceReleaseConfig();
  duplicate.env.production.d1_databases[0].database_id = "staging-db-id";
  assert.throws(() => releaseTargetFromConfig(duplicate, "staging"), /D1 database IDs must differ/);
});

test("generated deploy artifactはMarketsの全release bindingを要求する", async () => {
  const { assertDeployEnvironment, assertGeneratedConfig } =
    await import("../../scripts/deploy-generated.mjs");
  const { releaseTargetFromConfig } = await import("../../scripts/migrate-d1.mjs");
  const expected = releaseTargetFromConfig(sourceReleaseConfig(), "staging");
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
    d1_databases: [
      {
        binding: "DB",
        database_name: "markets-staging",
        database_id: "staging-db-id",
        migrations_dir: "drizzle",
      },
    ],
    durable_objects: { bindings: [{ name: "AUCTION_ROOMS", class_name: "AuctionRoom" }] },
    workflows: [{ binding: "AUCTION_SETTLEMENT", name: "auction-settlement-staging" }],
    services: [{ binding: "POINTS_SERVICE", service: "points-worker-staging" }],
    analytics_engine_datasets: [{ binding: "OPS_METRICS", dataset: "markets_ops_staging" }],
    send_email: [{ name: "OPS_ALERT_EMAIL", destination_address: "ops@example.test" }],
    triggers: { crons: ["*/5 * * * *"] },
    routes: [{ pattern: "staging.markets.freeism.app", custom_domain: true }],
    observability: {
      enabled: true,
      logs: { head_sampling_rate: 1 },
      traces: { enabled: true, head_sampling_rate: 1 },
    },
  };

  assert.doesNotThrow(() => assertGeneratedConfig(config, "staging", expected));
  assert.throws(
    () => assertGeneratedConfig({ ...config, services: [] }, "staging", expected),
    /POINTS_SERVICE/,
  );
  assert.throws(
    () =>
      assertGeneratedConfig(
        {
          ...config,
          d1_databases: [{ ...config.d1_databases[0], database_id: "production-db-id" }],
        },
        "staging",
        expected,
      ),
    /D1 DB/,
  );
  assert.throws(() => assertDeployEnvironment("staging", "production"), /CLOUDFLARE_ENV/);
});

test("deploy artifact freshnessはsource/worker/lockfileより古いartifactを拒否する", async () => {
  const { assertArtifactFreshness } = await import("../../scripts/deploy-generated.mjs");
  assert.doesNotThrow(() =>
    assertArtifactFreshness({ artifact: 20, lockfile: 10, source: 10, worker: 20 }),
  );
  assert.throws(
    () => assertArtifactFreshness({ artifact: 20, lockfile: 21, source: 10, worker: 20 }),
    /stale/,
  );

  const root = await mkdtemp(resolve(tmpdir(), "markets-generated-config-"));
  try {
    await mkdir(resolve(root, "dist/server"), { recursive: true });
    await writeFile(resolve(root, "dist/server/wrangler.json"), "{}\n");
    await mkdir(resolve(root, "dist"), { recursive: true });
    await writeFile(resolve(root, "dist/wrangler.json"), "{}\n");
    const { findGeneratedWorkerConfig } =
      await import("../../../../scripts/web-app/assert-worker-build.mjs");
    await assert.rejects(() => findGeneratedWorkerConfig(root), /found 2/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("smokeは固定originへのread-only checkだけを持つ", async () => {
  const { smokeChecks, smokeOrigin } = await import("../../scripts/smoke.mjs");

  assert.equal(smokeOrigin("production"), "https://markets.freeism.app");
  assert.ok(smokeChecks().every((check) => check.method === "GET"));
  assert.ok(smokeChecks().some((check) => check.path === "/api/health"));
  assert.ok(smokeChecks().some((check) => check.path.startsWith("/api/v1/auctions")));
});
