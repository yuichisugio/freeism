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
];

const REQUIRED_SCHEMA_INVARIANTS = [
  [
    "table",
    "buy_now_holds",
    /buy_now_holds_status_check["`]?\s+CHECK/i,
    "check constraint buy_now_holds_status_check",
  ],
  [
    "table",
    "auction_close_cutoffs",
    /auction_close_cutoffs_hash_check["`]?\s+CHECK/i,
    "check constraint auction_close_cutoffs_hash_check",
  ],
  [
    "table",
    "settlement_plans",
    /settlement_plans_json_check["`]?\s+CHECK/i,
    "check constraint settlement_plans_json_check",
  ],
  [
    "table",
    "settlement_rounds",
    /settlement_rounds_state_check["`]?\s+CHECK/i,
    "check constraint settlement_rounds_state_check",
  ],
  [
    "table",
    "settlement_round_winners",
    /settlement_round_winners_status_check["`]?\s+CHECK/i,
    "check constraint settlement_round_winners_status_check",
  ],
  [
    "table",
    "settlement_exclusions",
    /settlement_exclusions_reason_check["`]?\s+CHECK/i,
    "check constraint settlement_exclusions_reason_check",
  ],
  [
    "table",
    "auction_close_resume_outbox",
    /auction_close_resume_outbox_status_check["`]?\s+CHECK/i,
    "check constraint auction_close_resume_outbox_status_check",
  ],
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
    "index",
    "buy_now_holds_auction_status_idx",
    /^CREATE INDEX[\s\S]*ON\s+["`]?buy_now_holds["`]?\s*\(\s*["`]?auction_id["`]?\s*,\s*["`]?status["`]?\s*\)/i,
    "index buy_now_holds_auction_status_idx",
  ],
  [
    "index",
    "settlement_plans_revision_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlement_plans["`]?\s*\(\s*["`]?settlement_id["`]?\s*,\s*["`]?settlement_revision["`]?\s*\)/i,
    "unique index settlement_plans_revision_uidx",
  ],
  [
    "index",
    "settlement_rounds_ordinal_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlement_rounds["`]?\s*\(\s*["`]?settlement_id["`]?\s*,\s*["`]?round_ordinal["`]?\s*\)/i,
    "unique index settlement_rounds_ordinal_uidx",
  ],
  [
    "index",
    "settlement_round_winners_user_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlement_round_winners["`]?\s*\(\s*["`]?settlement_round_id["`]?\s*,\s*["`]?markets_user_id["`]?\s*\)/i,
    "unique index settlement_round_winners_user_uidx",
  ],
  [
    "index",
    "settlement_round_winners_key_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlement_round_winners["`]?\s*\(\s*["`]?reservation_key["`]?\s*\)/i,
    "unique index settlement_round_winners_key_uidx",
  ],
  [
    "index",
    "settlement_exclusions_user_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?settlement_exclusions["`]?\s*\(\s*["`]?settlement_id["`]?\s*,\s*["`]?markets_user_id["`]?\s*\)/i,
    "unique index settlement_exclusions_user_uidx",
  ],
  [
    "index",
    "auction_close_resume_outbox_hold_uidx",
    /^CREATE UNIQUE INDEX[\s\S]*ON\s+["`]?auction_close_resume_outbox["`]?\s*\(\s*["`]?buy_now_hold_id["`]?\s*\)/i,
    "unique index auction_close_resume_outbox_hold_uidx",
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
    "auction_close_cutoffs_append_only_update",
    "auction_close_cutoffs_append_only_delete",
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

function matchesAllocationVectorHashCheck(sql) {
  const match = sql.match(
    /settlement_allocations_vector_hash_check["`]?\s+CHECK\s*\(\s*length\s*\(\s*(?:["`]?settlement_allocations["`]?\s*\.\s*)?["`]?vector_hash["`]?\s*\)\s*=\s*64\s+or\s*\(\s*length\s*\(\s*(?:["`]?settlement_allocations["`]?\s*\.\s*)?["`]?vector_hash["`]?\s*\)\s*=\s*71\s+and\s+substr\s*\(\s*(?:["`]?settlement_allocations["`]?\s*\.\s*)?["`]?vector_hash["`]?\s*,\s*1\s*,\s*7\s*\)\s*=\s*'sha256:'\s*\)\s*\)/i,
  );
  return match !== null && match[0].includes("'sha256:'");
}

const REQUIRED_FUTURE_TABLE_INVARIANTS = [
  [
    "settlement_capture_receipts",
    /settlement_capture_receipts_plan_hash_check["`]?\s+CHECK\s*\(\s*length\s*\(\s*(?:["`]?settlement_capture_receipts["`]?\s*\.\s*)?["`]?plan_hash["`]?\s*\)\s*=\s*64\s*\)/i,
    "capture receipt plan hash check",
  ],
  ["settlement_allocations", matchesAllocationVectorHashCheck, "allocation vector hash check"],
  [
    "proofs",
    /proofs_content_hash_check["`]?\s+CHECK\s*\(\s*length\s*\(\s*(?:["`]?proofs["`]?\s*\.\s*)?["`]?content_hash["`]?\s*\)\s*=\s*64\s*\)/i,
    "proof content hash check",
  ],
  [
    "settlement_finalize_receipts",
    /settlement_finalize_receipts_proof_set_hash_check["`]?\s+CHECK\s*\(\s*length\s*\(\s*(?:["`]?settlement_finalize_receipts["`]?\s*\.\s*)?["`]?proof_set_hash["`]?\s*\)\s*=\s*64\s*\)/i,
    "finalize receipt proof set hash check",
  ],
  [
    "settlement_retry_authorizations",
    /CHECK\s*\([\s\S]*status[\s\S]*STARTED[\s\S]*PENDING[\s\S]*USED[\s\S]*EXPIRED/i,
    "retry authorization status check",
  ],
  [
    "settlement_retry_assertion_jtis",
    /CHECK\s*\([\s\S]*status[\s\S]*PENDING[\s\S]*USED/i,
    "retry assertion status check",
  ],
  [
    "ops_alert_cleanup_leases",
    /lease_key[\s\S]*PRIMARY KEY[\s\S]*lease_expires_at/i,
    "cleanup lease primary key and expiry",
  ],
  [
    "settlement_reconciliation_leases",
    /settlement_id[\s\S]*PRIMARY KEY[\s\S]*lease_expires_at/i,
    "reconciliation lease primary key and expiry",
  ],
  [
    "proof_reviews",
    /CHECK\s*\([\s\S]*direction[\s\S]*SELLER_TO_BUYER[\s\S]*BUYER_TO_SELLER/i,
    "proof review direction check",
  ],
  [
    "proof_reviews",
    /CHECK\s*\([\s\S]*revision_number[\s\S]*(?:>=|between)\s*1/i,
    "proof review revision check",
  ],
  [
    "proof_review_revisions",
    /CHECK\s*\([\s\S]*rating[\s\S]*(?:BETWEEN\s+1\s+AND\s+5|>=\s*1[\s\S]*<=\s*5)/i,
    "proof review rating check",
  ],
  ["ops_alerts", /CHECK\s*\([\s\S]*repeat_count[\s\S]*>=\s*1/i, "ops alert repeat count check"],
];

const REQUIRED_FUTURE_INDEX_CONTRACTS = [
  ["settlement_capture_receipts", ["settlement_id"], true, "capture receipt settlement unique"],
  [
    "settlement_allocations",
    ["settlement_id", "allocation_ordinal"],
    true,
    "allocation ordinal unique",
  ],
  [
    "settlement_allocations",
    ["settlement_id", "buyer_markets_user_id"],
    true,
    "allocation buyer unique",
  ],
  ["settlement_allocations", ["point_reservation_id"], true, "allocation reservation unique"],
  ["proofs", ["allocation_id"], true, "proof allocation unique"],
  ["settlement_finalize_receipts", ["settlement_id"], true, "finalize settlement unique"],
  ["settlement_finalize_receipts", ["capture_receipt_id"], true, "finalize capture receipt unique"],
  ["settlement_retry_authorizations", ["state_hash"], true, "retry state hash unique"],
  ["settlement_retry_authorizations", ["assertion_jti"], true, "retry assertion JTI unique"],
  [
    "settlement_retry_assertion_jtis",
    ["authorization_id"],
    true,
    "retry assertion authorization unique",
  ],
  ["settlement_retry_rate_events", ["jti"], true, "retry rate event JTI unique"],
  [
    "settlement_retry_rate_events",
    ["points_admin_subject_hash", "markets_user_id", "auction_id", "created_at"],
    false,
    "retry rate lookup index",
  ],
  ["proof_reviews", ["proof_id", "direction"], true, "proof review direction unique"],
  [
    "proof_review_revisions",
    ["review_id", "revision_number"],
    true,
    "proof review revision unique",
  ],
  [
    "proof_review_revisions",
    ["review_id", "created_at", "id"],
    false,
    "proof review history index",
  ],
  ["watchlist_entries", ["markets_user_id", "auction_id"], true, "watchlist user auction unique"],
  [
    "watchlist_entries",
    ["markets_user_id", "created_at", "auction_id"],
    false,
    "watchlist listing index",
  ],
  ["ops_alerts", ["status", "resolved_at"], false, "ops alert cleanup index"],
];

const REQUIRED_FUTURE_APPEND_ONLY_TABLES = [
  "settlement_capture_receipts",
  "settlement_allocations",
  "proofs",
  "settlement_finalize_receipts",
  "settlement_retry_rate_events",
  "proof_review_revisions",
];

const REQUIRED_TRIGGER_CONTRACTS = [
  ["settlement_rounds", "DELETE", "settlement_rounds delete guard"],
  ["settlement_round_winners", "DELETE", "settlement_round_winners delete guard"],
  ["settlement_exclusions", "DELETE", "settlement_exclusions delete guard"],
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

export function assertCurrentSchemaInvariants(rows) {
  const byKey = new Map(rows.map((row) => [`${row.type}:${row.name}`, row.sql ?? ""]));
  for (const [type, name, pattern, label] of REQUIRED_SCHEMA_INVARIANTS) {
    const sql = byKey.get(`${type}:${name}`);
    if (!sql || !pattern.test(sql)) throw new Error(`empty D1 is missing ${label}`);
  }
}

export function assertSchemaInvariants(rows) {
  assertCurrentSchemaInvariants(rows);
  assertReservationRoundSchemaInvariants(rows);
  assertFutureSchemaInvariants(rows);
}

export function assertReservationRoundSchemaInvariants(rows) {
  for (const [table, operation, label] of REQUIRED_TRIGGER_CONTRACTS) {
    const found = rows.some(
      (row) =>
        row.type === "trigger" &&
        row.tbl_name === table &&
        new RegExp(
          `BEFORE\\s+${operation}\\s+ON\\s+["\\\`]?${table}["\\\`]?[\\s\\S]*RAISE\\s*\\(\\s*ABORT`,
          "i",
        ).test(row.sql ?? ""),
    );
    if (!found) throw new Error(`empty D1 is missing ${label}`);
  }
  const hasWinnerStatusGuard = rows.some(
    (row) =>
      row.type === "trigger" &&
      row.tbl_name === "settlement_round_winners" &&
      /BEFORE\s+UPDATE\s+OF\s+["`]?status["`]?\s+ON\s+["`]?settlement_round_winners["`]?[\s\S]*RAISE\s*\(\s*ABORT/i.test(
        row.sql ?? "",
      ),
  );
  if (!hasWinnerStatusGuard) {
    throw new Error("empty D1 is missing settlement_round_winners status transition guard");
  }
}

function indexColumnsPattern(table, columns, unique) {
  const tablePattern = `["\\\`]?${table}["\\\`]?`;
  const columnPattern = columns.map((column) => `["\\\`]?${column}["\\\`]?`).join("\\s*,\\s*");
  return new RegExp(
    `^CREATE\\s+${unique ? "UNIQUE\\s+" : ""}INDEX[\\s\\S]*ON\\s+${tablePattern}\\s*\\(\\s*${columnPattern}\\s*\\)`,
    "i",
  );
}

function hasAbortTrigger(rows, table, operation) {
  return rows.some(
    (row) =>
      row.type === "trigger" &&
      row.tbl_name === table &&
      new RegExp(
        `BEFORE\\s+${operation}\\s+ON\\s+["\\\`]?${table}["\\\`]?[\\s\\S]*RAISE\\s*\\(\\s*ABORT`,
        "i",
      ).test(row.sql ?? ""),
  );
}

export function assertFutureSchemaInvariants(rows) {
  const byKey = new Map(rows.map((row) => [`${row.type}:${row.name}`, row.sql ?? ""]));
  for (const [name, invariant, label] of REQUIRED_FUTURE_TABLE_INVARIANTS) {
    const sql = byKey.get(`table:${name}`);
    const matches =
      typeof invariant === "function" ? invariant(sql ?? "") : invariant.test(sql ?? "");
    if (!sql || !matches) throw new Error(`empty D1 is missing ${label}`);
  }
  for (const [table, columns, unique, label] of REQUIRED_FUTURE_INDEX_CONTRACTS) {
    const pattern = indexColumnsPattern(table, columns, unique);
    if (!rows.some((row) => row.type === "index" && pattern.test(row.sql ?? ""))) {
      throw new Error(`empty D1 is missing ${label}`);
    }
  }
  for (const table of REQUIRED_FUTURE_APPEND_ONLY_TABLES) {
    for (const operation of ["UPDATE", "DELETE"]) {
      if (!hasAbortTrigger(rows, table, operation)) {
        throw new Error(`empty D1 is missing ${table} ${operation.toLowerCase()} guard`);
      }
    }
  }
  if (!hasAbortTrigger(rows, "settlement_retry_assertion_jtis", "UPDATE(?:\\s+OF\\s+status)?")) {
    throw new Error("empty D1 is missing retry assertion status guard");
  }
  if (!hasAbortTrigger(rows, "proof_reviews", "UPDATE")) {
    throw new Error("empty D1 is missing proof review current pointer guard");
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
