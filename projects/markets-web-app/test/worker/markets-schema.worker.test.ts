import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();

async function appliedMigrationNames() {
  const result = await db
    .prepare("SELECT name FROM d1_migrations ORDER BY id")
    .all<{ name: string }>();
  return result.results.map((row) => row.name);
}

async function schemaObjectSql(tableName: string) {
  const result = await db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE tbl_name = ? AND sql IS NOT NULL ORDER BY type, name",
    )
    .bind(tableName)
    .all<{ sql: string }>();
  return result.results.map((row) => row.sql).join("\n");
}

async function tableColumns(tableName: string) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all<{ name: string; pk: number; type: string }>()
    .then((result) => result.results);
}

async function uniqueIndexColumns(tableName: string) {
  const indexes = await db
    .prepare(`PRAGMA index_list(${tableName})`)
    .all<{ name: string; unique: number }>();
  const uniqueIndexes = indexes.results.filter((index) => index.unique === 1);
  return Promise.all(
    uniqueIndexes.map(async (index) => {
      const columns = await db
        .prepare(`PRAGMA index_info(${index.name})`)
        .all<{ name: string; seqno: number }>();
      return columns.results
        .sort((left, right) => left.seqno - right.seqno)
        .map((column) => column.name);
    }),
  );
}

describe("Markets greenfield domain schema", () => {
  it("applies the six greenfield migrations in sequence", async () => {
    await expect(appliedMigrationNames()).resolves.toEqual([
      "0000_markets-auth.sql",
      "0001_points-oauth-connection.sql",
      "0002_markets-domain.sql",
      "0003_auction-command-guards.sql",
      "0004_settlement-saga.sql",
      "0005_settlement-reservation-rounds.sql",
    ]);
  });

  it("owns Auction and Package snapshots without a separate Listing resource", async () => {
    const tables = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    const names = tables.results.map((row) => row.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "auctions",
        "auction_revisions",
        "point_package_snapshots",
        "point_package_snapshot_components",
        "auction_commands",
        "bid_positions",
        "bid_events",
        "auto_bid_rules",
        "buy_now_holds",
        "auction_blacklist_events",
        "idempotency_results",
        "audit_events",
        "websocket_slot_leases",
        "turnstile_token_replays",
        "ops_alerts",
      ]),
    );
    expect(names.filter((name) => name.includes("listing"))).toEqual([]);

    const domainSql = (
      await db
        .prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'")
        .all<{ sql: string }>()
    ).results
      .map((row) => row.sql)
      .join("\n");
    expect(domainSql).not.toMatch(/\blisting(?:s|_id)?\b/i);
    expect(domainSql).not.toContain("lst_");
  });

  it("stores economic values as constrained safe integers with canonical tick-count names", async () => {
    const expectedEconomicColumns = new Map([
      ["auction_revisions", ["quantity", "package_tick", "buy_now_price_tick_count"]],
      ["bid_positions", ["quantity", "price_tick_count"]],
      ["auto_bid_rules", ["quantity", "auto_bid_max_tick_count"]],
      ["buy_now_holds", ["quantity", "buy_now_price_tick_count"]],
    ]);

    for (const [tableName, expectedNames] of expectedEconomicColumns) {
      const columns = await tableColumns(tableName);
      for (const name of expectedNames) {
        expect(
          columns.find((column) => column.name === name),
          `${tableName}.${name}`,
        ).toMatchObject({
          type: "INTEGER",
        });
      }
      expect(columns.filter((column) => column.type.toUpperCase() === "REAL")).toEqual([]);
    }

    const revisionSql = await schemaObjectSql("auction_revisions");
    expect(revisionSql).toMatch(/quantity[^\n]+between 1 and 1000/i);
    expect(revisionSql).toMatch(/package_tick[^\n]+9007199254740991/i);
    expect(revisionSql).toMatch(/buy_now_price_tick_count[^\n]+between 1 and 9007199254740991/i);
    expect(revisionSql).not.toMatch(/\bREAL\b/i);
  });

  it("declares command, event, active-position, slot, and Turnstile uniqueness", async () => {
    await expect(uniqueIndexColumns("auction_commands")).resolves.toContainEqual([
      "auction_id",
      "command_id",
    ]);
    await expect(uniqueIndexColumns("bid_events")).resolves.toContainEqual([
      "auction_id",
      "bid_seq",
    ]);
    await expect(uniqueIndexColumns("bid_positions")).resolves.toContainEqual([
      "auction_id",
      "bidder_markets_user_id",
    ]);

    const slotIndexes = await uniqueIndexColumns("websocket_slot_leases");
    expect(slotIndexes).toContainEqual(["markets_user_id", "user_slot"]);
    expect(slotIndexes).toContainEqual(["markets_user_id", "auction_id", "auction_slot"]);
    const slotSql = await schemaObjectSql("websocket_slot_leases");
    expect(slotSql).toMatch(/user_slot[^\n]+between 1 and 20/i);
    expect(slotSql).toMatch(/auction_slot[^\n]+between 1 and 3/i);

    const turnstileColumns = await tableColumns("turnstile_token_replays");
    const tokenHash = turnstileColumns.find((column) => column.name === "token_hash");
    const turnstileIndexes = await uniqueIndexColumns("turnstile_token_replays");
    expect(
      tokenHash?.pk === 1 || turnstileIndexes.some((columns) => columns.join() === "token_hash"),
    ).toBe(true);
  });

  it("keeps audit and bid events append-only and prevents cascading domain deletion", async () => {
    for (const tableName of ["audit_events", "bid_events"]) {
      const triggers = await db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?")
        .bind(tableName)
        .all<{ sql: string }>();
      const sql = triggers.results.map((row) => row.sql).join("\n");
      expect(sql).toMatch(/before update/i);
      expect(sql).toMatch(/before delete/i);
    }

    for (const tableName of [
      "auctions",
      "auction_revisions",
      "auction_commands",
      "bid_positions",
      "bid_events",
      "auto_bid_rules",
      "buy_now_holds",
    ]) {
      const foreignKeys = await db
        .prepare(`PRAGMA foreign_key_list(${tableName})`)
        .all<{ on_delete: string }>();
      expect(
        foreignKeys.results.map((foreignKey) => foreignKey.on_delete.toUpperCase()),
      ).not.toContain("CASCADE");
    }
  });

  it("rolls back the whole D1 batch when a later statement fails", async () => {
    await db.exec(
      "CREATE TABLE IF NOT EXISTS task3_batch_probe (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); DELETE FROM task3_batch_probe;",
    );

    await expect(
      db.batch([
        db.prepare("INSERT INTO task3_batch_probe (id, value) VALUES ('probe', 'first')"),
        db.prepare("INSERT INTO task3_batch_probe (id, value) VALUES ('probe', 'duplicate')"),
      ]),
    ).rejects.toThrow(/unique|constraint/i);

    const row = await db
      .prepare("SELECT count(*) AS count FROM task3_batch_probe")
      .first<{ count: number }>();
    expect(row?.count).toBe(0);
  });

  it("keeps operational alert state safe and excludes response or token storage", async () => {
    const columns = (await tableColumns("ops_alerts")).map((column) => column.name);
    expect(columns).toEqual(
      expect.arrayContaining([
        "dedupe_key",
        "signal",
        "severity",
        "first_seen_at",
        "last_seen_at",
        "resolved_at",
        "status",
        "delivery_attempt_count",
      ]),
    );
    expect(columns.some((column) => column.includes("token"))).toBe(false);
    expect(columns).not.toContain("response_body");
  });
});
