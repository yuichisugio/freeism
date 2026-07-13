import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_SCHEMA_OBJECTS = [
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
];

const REQUIRED_SCHEMA_INVARIANTS = [
  [
    "table",
    "settlements",
    /settlements_state_check["`]?\s+CHECK/i,
    "check constraint settlements_state_check",
  ],
  [
    "table",
    "settlement_outbox",
    /settlement_outbox_status_check["`]?\s+CHECK/i,
    "check constraint settlement_outbox_status_check",
  ],
  [
    "index",
    "settlements_source_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlements["`]?\s*\(\s*["`]?auction_id["`]?\s*,\s*["`]?kind["`]?\s*,\s*["`]?source_key["`]?\s*\)/i,
    "unique index settlements_source_uidx",
  ],
  [
    "index",
    "settlement_outbox_attempt_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlement_outbox["`]?\s*\(\s*["`]?settlement_id["`]?\s*,\s*["`]?settlement_revision["`]?\s*,\s*["`]?workflow_attempt["`]?\s*\)/i,
    "unique index settlement_outbox_attempt_uidx",
  ],
  [
    "table",
    "ops_alert_cleanup_leases",
    /lease_key[\s\S]*PRIMARY KEY[\s\S]*lease_expires_at/i,
    "cleanup lease primary key and expiry",
  ],
  ...[
    "audit_events_append_only_update",
    "audit_events_append_only_delete",
    "auction_revisions_append_only_update",
    "auction_revisions_append_only_delete",
    "bid_events_append_only_update",
    "bid_events_append_only_delete",
    "settlement_plans_append_only_update",
    "settlement_plans_append_only_delete",
  ].map((name) => {
    const operation = name.endsWith("_delete") ? "DELETE" : "UPDATE";
    return [
      "trigger",
      name,
      new RegExp(
        `^CREATE TRIGGER[\\s\\S]*BEFORE\\s+${operation}\\s+ON[\\s\\S]*RAISE\\s*\\(\\s*ABORT`,
        "i",
      ),
      `trigger ${name}`,
    ];
  }),
];

export function assertMigrationSequence(fileNames) {
  const migrations = fileNames.filter((file) => /^\d{4}_[A-Za-z0-9._-]+\.sql$/.test(file)).sort();
  const seen = new Set();
  for (let index = 0; index < migrations.length; index += 1) {
    const file = migrations[index];
    const number = file.slice(0, 4);
    if (seen.has(number)) throw new Error(`duplicate migration ${number}`);
    seen.add(number);
    const expected = String(index).padStart(4, "0");
    if (number !== expected) throw new Error(`missing migration ${expected}; found ${number}`);
  }
  if (migrations.length === 0) throw new Error("no D1 migrations found");
  return migrations;
}

export function assertMigrationJournal(migrations, journal) {
  const expected = migrations.map((file) => file.replace(/\.sql$/, ""));
  const actual = (journal.entries ?? []).map((entry) => entry.tag);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `migration journal order does not match SQL files: expected ${expected.join(",")}; received ${actual.join(",")}`,
    );
  }
}

export function assertRequiredSchema(rows) {
  const actual = new Set(rows.map((row) => `${row.type}:${row.name}`));
  const missing = REQUIRED_SCHEMA_OBJECTS.filter(([type, name]) => !actual.has(`${type}:${name}`));
  if (missing.length > 0) {
    throw new Error(
      `empty D1 is missing schema objects: ${missing.map((item) => item.join(":")).join(", ")}`,
    );
  }
  for (const legacy of ["listing", "listings"]) {
    if (actual.has(`table:${legacy}`))
      throw new Error(`legacy Listing table is forbidden: ${legacy}`);
  }
}

export function assertSchemaInvariants(rows) {
  const byKey = new Map(rows.map((row) => [`${row.type}:${row.name}`, row.sql ?? ""]));
  for (const [type, name, pattern, label] of REQUIRED_SCHEMA_INVARIANTS) {
    const sql = byKey.get(`${type}:${name}`);
    if (!sql || !pattern.test(sql)) throw new Error(`empty D1 is missing ${label}`);
  }
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runWrangler(args, capture = false) {
  const result = spawnSync("wrangler", args, {
    cwd: appRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: tmpdir(),
      WRANGLER_LOG_PATH: resolve(tmpdir(), "markets-verify-empty-d1.log"),
      WRANGLER_SEND_METRICS: "false",
    },
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(capture ? result.stderr || result.stdout : `wrangler exited ${result.status}`);
  }
  return capture ? result.stdout : "";
}

export async function verifyEmptyD1() {
  const migrations = assertMigrationSequence(await readdir(resolve(appRoot, "drizzle")));
  const journal = JSON.parse(
    await readFile(resolve(appRoot, "drizzle/meta/_journal.json"), "utf8"),
  );
  assertMigrationJournal(migrations, journal);
  const persistence = await mkdtemp(resolve(tmpdir(), "markets-empty-d1-"));
  try {
    runWrangler([
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--persist-to",
      persistence,
      "--config",
      "wrangler.jsonc",
    ]);
    const output = runWrangler(
      [
        "d1",
        "execute",
        "DB",
        "--local",
        "--persist-to",
        persistence,
        "--config",
        "wrangler.jsonc",
        "--command",
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE type IN ('table', 'index', 'trigger') ORDER BY type, name",
        "--json",
      ],
      true,
    );
    const payload = JSON.parse(output);
    if (!payload[0]?.success) throw new Error("empty D1 schema inspection failed");
    assertRequiredSchema(payload[0].results ?? []);
    assertSchemaInvariants(payload[0].results ?? []);
    process.stdout.write("Markets empty D1 migrations and release schema: PASS\n");
  } finally {
    await rm(persistence, { force: true, recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyEmptyD1();
}
