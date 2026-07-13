import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    ["table", "buy_now_holds"],
    ["table", "auction_close_cutoffs"],
    ["table", "settlement_plans"],
    ["table", "settlement_rounds"],
    ["table", "settlement_round_winners"],
    ["table", "settlement_exclusions"],
    ["table", "auction_close_resume_outbox"],
    ["table", "settlement_capture_receipts"],
    ["table", "settlement_allocations"],
    ["table", "proofs"],
    ["table", "settlement_finalize_receipts"],
    ["table", "settlement_retry_authorizations"],
    ["table", "settlement_retry_assertion_jtis"],
    ["table", "settlement_retry_rate_events"],
    ["table", "settlement_reconciliation_leases"],
    ["table", "proof_reviews"],
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
  assert.throws(
    () => assertRequiredSchema(rows.filter((row) => row.name !== "buy_now_holds")),
    /buy_now_holds/,
  );
  assert.throws(
    () => assertRequiredSchema(rows.filter((row) => row.name !== "settlement_capture_receipts")),
    /settlement_capture_receipts/,
  );
  assert.throws(
    () => assertRequiredSchema(rows.filter((row) => row.name !== "auction_close_resume_outbox")),
    /auction_close_resume_outbox/,
  );
  assert.throws(
    () =>
      assertRequiredSchema(rows.filter((row) => row.name !== "settlement_retry_authorizations")),
    /settlement_retry_authorizations/,
  );
});

test("empty D1の主要unique/check/append-only triggerを検査する", async () => {
  const { assertSchemaInvariants } = await import("../../scripts/verify-empty-d1.mjs");
  const rows = [
    {
      type: "table",
      name: "buy_now_holds",
      sql: "CREATE TABLE buy_now_holds (CONSTRAINT \"buy_now_holds_status_check\" CHECK (status IN ('PENDING')))",
    },
    {
      type: "table",
      name: "auction_close_cutoffs",
      sql: 'CREATE TABLE auction_close_cutoffs (CONSTRAINT "auction_close_cutoffs_hash_check" CHECK (length(ranking_input_hash) = 64))',
    },
    {
      type: "table",
      name: "settlement_plans",
      sql: 'CREATE TABLE settlement_plans (CONSTRAINT "settlement_plans_json_check" CHECK (json_valid(plan_json)))',
    },
    {
      type: "table",
      name: "settlement_rounds",
      sql: "CREATE TABLE settlement_rounds (CONSTRAINT \"settlement_rounds_state_check\" CHECK (state IN ('RESERVING')))",
    },
    {
      type: "table",
      name: "settlement_round_winners",
      sql: "CREATE TABLE settlement_round_winners (CONSTRAINT \"settlement_round_winners_status_check\" CHECK (status IN ('PENDING')))",
    },
    {
      type: "table",
      name: "settlement_exclusions",
      sql: "CREATE TABLE settlement_exclusions (CONSTRAINT \"settlement_exclusions_reason_check\" CHECK (reason IN ('INSUFFICIENT_BALANCE')))",
    },
    {
      type: "table",
      name: "auction_close_resume_outbox",
      sql: "CREATE TABLE auction_close_resume_outbox (CONSTRAINT \"auction_close_resume_outbox_status_check\" CHECK (status IN ('PENDING')))",
    },
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
    {
      type: "index",
      name: "buy_now_holds_auction_status_idx",
      sql: "CREATE INDEX buy_now_holds_auction_status_idx ON buy_now_holds (auction_id,status)",
    },
    {
      type: "index",
      name: "settlement_plans_revision_uidx",
      sql: "CREATE UNIQUE INDEX settlement_plans_revision_uidx ON settlement_plans (settlement_id,settlement_revision)",
    },
    {
      type: "index",
      name: "settlement_rounds_ordinal_uidx",
      sql: "CREATE UNIQUE INDEX settlement_rounds_ordinal_uidx ON settlement_rounds (settlement_id,round_ordinal)",
    },
    {
      type: "index",
      name: "settlement_round_winners_user_uidx",
      sql: "CREATE UNIQUE INDEX settlement_round_winners_user_uidx ON settlement_round_winners (settlement_round_id,markets_user_id)",
    },
    {
      type: "index",
      name: "settlement_round_winners_key_uidx",
      sql: "CREATE UNIQUE INDEX settlement_round_winners_key_uidx ON settlement_round_winners (reservation_key)",
    },
    {
      type: "index",
      name: "settlement_exclusions_user_uidx",
      sql: "CREATE UNIQUE INDEX settlement_exclusions_user_uidx ON settlement_exclusions (settlement_id,markets_user_id)",
    },
    {
      type: "index",
      name: "auction_close_resume_outbox_hold_uidx",
      sql: "CREATE UNIQUE INDEX auction_close_resume_outbox_hold_uidx ON auction_close_resume_outbox (buy_now_hold_id)",
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
      ["auction_close_cutoffs_append_only_update", "UPDATE"],
      ["auction_close_cutoffs_append_only_delete", "DELETE"],
    ].map(([name, operation]) => ({
      type: "trigger",
      name,
      sql: `CREATE TRIGGER ${name} BEFORE ${operation} ON target BEGIN SELECT RAISE(ABORT, 'IMMUTABLE'); END`,
    })),
    ...[
      ["settlement_rounds_delete_guard", "settlement_rounds", "BEFORE DELETE"],
      ["settlement_round_winners_delete_guard", "settlement_round_winners", "BEFORE DELETE"],
      ["settlement_exclusions_delete_guard", "settlement_exclusions", "BEFORE DELETE"],
      [
        "settlement_round_winners_status_guard",
        "settlement_round_winners",
        "BEFORE UPDATE OF status",
      ],
    ].map(([name, tbl_name, operation]) => ({
      type: "trigger",
      name,
      tbl_name,
      sql: `CREATE TRIGGER ${name} ${operation} ON ${tbl_name} BEGIN SELECT RAISE(ABORT, 'INVALID'); END`,
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
  assert.throws(
    () =>
      assertSchemaInvariants(
        rows.filter((row) => row.name !== "auction_close_resume_outbox_hold_uidx"),
      ),
    /auction_close_resume_outbox_hold_uidx/,
  );
  assert.throws(
    () =>
      assertSchemaInvariants(
        rows.filter((row) => row.name !== "settlement_round_winners_status_guard"),
      ),
    /settlement_round_winners.*status/i,
  );
});

test("実0000〜0006 schema dumpで着地済みinvariant driftを検出する", async () => {
  const { assertCurrentSchemaInvariants } = await import("../../scripts/verify-empty-d1.mjs");
  const rows = JSON.parse(
    await readFile(
      new URL("../fixtures/release/empty-d1-current-schema.json", import.meta.url),
      "utf8",
    ),
  );

  assert.doesNotThrow(() => assertCurrentSchemaInvariants(rows));
  for (const name of [
    "buy_now_holds_auction_status_idx",
    "settlement_plans_revision_uidx",
    "settlement_rounds_ordinal_uidx",
    "settlement_round_winners_user_uidx",
    "settlement_round_winners_key_uidx",
    "settlement_exclusions_user_uidx",
    "auction_close_resume_outbox_hold_uidx",
    "auction_close_cutoffs_append_only_delete",
  ]) {
    assert.throws(
      () => assertCurrentSchemaInvariants(rows.filter((row) => row.name !== name)),
      new RegExp(name),
    );
  }
  assert.throws(
    () =>
      assertCurrentSchemaInvariants(
        rows.map((row) =>
          row.name === "settlement_round_winners"
            ? { ...row, sql: row.sql.replace("settlement_round_winners_status_check", "removed") }
            : row,
        ),
      ),
    /settlement_round_winners_status_check/,
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
          'import next from "next";\nimport { headers } from "next/server";\nimport "next/headers";\nnew EventSource("/events")',
      },
      { file: "worker/index.ts", source: 'import { Hono } from "hono"' },
    ]),
    [
      { file: "src/server.ts", reference: "next" },
      { file: "src/server.ts", reference: "next/server" },
      { file: "src/server.ts", reference: "next/headers" },
      { file: "src/server.ts", reference: "EventSource" },
    ],
  );
});

test("runtime manifestとlock importerを一致させ直前build metadataを要求する", async () => {
  const { assertManifestLockParity, assertRuntimeArtifactMetadata } =
    await import("../../scripts/verify-runtime-boundaries.mjs");
  const manifest = { dependencies: { hono: "4.0.0" }, devDependencies: { vite: "8.0.0" } };

  assert.doesNotThrow(() => assertManifestLockParity(manifest, ["hono", "vite"]));
  assert.throws(() => assertManifestLockParity(manifest, ["hono"]), /manifest.*lockfile/i);
  assert.doesNotThrow(() =>
    assertRuntimeArtifactMetadata(
      { targetEnvironment: "staging", vars: { APP_ENV: "staging" } },
      { config: 20, source: 10, worker: 20 },
    ),
  );
  assert.throws(
    () =>
      assertRuntimeArtifactMetadata(
        { targetEnvironment: "production", vars: { APP_ENV: "staging" } },
        { config: 20, source: 10, worker: 20 },
      ),
    /target environment/i,
  );
  assert.throws(
    () =>
      assertRuntimeArtifactMetadata(
        { targetEnvironment: "staging", vars: { APP_ENV: "staging" } },
        { config: 9, source: 10, worker: 20 },
      ),
    /stale/i,
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

  for (const mutate of [
    (config) =>
      (config.env.production.d1_databases[0].database_name =
        config.env.staging.d1_databases[0].database_name),
    (config) => (config.env.production.name = config.env.staging.name),
    (config) => (config.env.production.workflows = config.env.staging.workflows),
    (config) => (config.env.production.services = config.env.staging.services),
    (config) =>
      (config.env.production.analytics_engine_datasets =
        config.env.staging.analytics_engine_datasets),
    (config) => (config.env.production.vars.POINTS_ISSUER = config.env.staging.vars.POINTS_ISSUER),
    (config) => (config.env.production.routes = config.env.staging.routes),
  ]) {
    const mixed = sourceReleaseConfig();
    mutate(mixed);
    assert.throws(
      () => releaseTargetFromConfig(mixed, "production"),
      /environment|staging|production/i,
    );
  }
});

test("generated deploy artifactはMarketsの全release bindingを要求する", async () => {
  const { assertDeployEnvironment, assertGeneratedConfig, assertSameMigrationDirectory } =
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
      run_worker_first: ["/api/*", "/.well-known/*"],
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
  assert.doesNotThrow(() =>
    assertSameMigrationDirectory(
      "/repo/projects/markets-web-app/wrangler.jsonc",
      "drizzle",
      "/repo/projects/markets-web-app/dist/server/wrangler.json",
      "../../drizzle",
    ),
  );
  assert.throws(
    () =>
      assertSameMigrationDirectory(
        "/repo/projects/markets-web-app/wrangler.jsonc",
        "drizzle",
        "/repo/projects/markets-web-app/dist/server/wrangler.json",
        "../other",
      ),
    /migration/i,
  );
  assert.throws(
    () =>
      assertGeneratedConfig(
        { ...config, assets: { ...config.assets, run_worker_first: ["/api/*"] } },
        "staging",
        expected,
      ),
    /Worker-first/i,
  );
  assert.throws(
    () =>
      assertGeneratedConfig(
        {
          ...config,
          assets: {
            ...config.assets,
            run_worker_first: ["/api/*", "/.well-known/*", "/admin/*"],
          },
        },
        "staging",
        expected,
      ),
    /Worker-first/i,
  );
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

test("Playwright E2Eは旧overrideを含めnon-loopback originを収集前に拒否する", () => {
  const appRoot = resolve(new URL("../..", import.meta.url).pathname);
  for (const environment of [
    {
      MARKETS_E2E_BASE_URL: "https://markets.freeism.app",
      MARKETS_E2E_ALLOW_REMOTE: "true",
    },
    { MARKETS_E2E_FIXTURE_ORIGIN: "https://fixture.example.test" },
    { MARKETS_E2E_ISSUER_ORIGIN: "https://issuer.example.test" },
  ]) {
    const result = spawnSync(
      "pnpm",
      ["exec", "playwright", "test", "-c", "playwright.config.ts", "--list"],
      {
        cwd: appRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          MARKETS_E2E_BASE_URL: "http://127.0.0.1:3001",
          MARKETS_E2E_FIXTURE_ORIGIN: "http://127.0.0.1:3101",
          MARKETS_E2E_ISSUER_ORIGIN: "http://127.0.0.1:3101",
          ...environment,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}${result.stdout}`, /loopback/i);
  }
});
