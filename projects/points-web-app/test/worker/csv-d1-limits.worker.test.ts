import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  chunkCanonicalJsonRows,
  prepareJsonEachStatements,
  runCsvAtomicBatch,
} from "../../src/backend/csv/d1-json-chunks";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();
const INSERT_SQL = `INSERT INTO csv_import_test (id, value)
SELECT json_extract(value, '$.id'), json_extract(value, '$.value')
FROM json_each(?)`;

describe("D1 CSV limits", () => {
  beforeEach(async () => {
    await db.exec(
      "DROP TABLE IF EXISTS csv_import_test; CREATE TABLE csv_import_test (id INTEGER PRIMARY KEY, value TEXT NOT NULL);",
    );
  });

  it("commits 1,000 rows near the 5 MiB input boundary in one batch under 30 seconds", async () => {
    const rows = Array.from({ length: 1_000 }, (_, id) => ({
      id,
      value: "x".repeat(5_200),
    }));
    const chunks = chunkCanonicalJsonRows(rows);
    const statements = prepareJsonEachStatements(db, INSERT_SQL, chunks);
    const startedAt = Date.now();
    await runCsvAtomicBatch(db, statements);

    const count = await db.prepare("SELECT COUNT(*) AS count FROM csv_import_test").first<{
      count: number;
    }>();
    expect(count?.count).toBe(1_000);
    expect(statements.length).toBeLessThanOrEqual(100);
    expect(Date.now() - startedAt).toBeLessThan(30_000);
  });

  it("rolls back every prior chunk when a later statement fails", async () => {
    const chunks = chunkCanonicalJsonRows(
      Array.from({ length: 1_000 }, (_, id) => ({ id, value: `v${id}` })),
      10_000,
    );
    const statements = [
      ...prepareJsonEachStatements(db, INSERT_SQL, chunks),
      db.prepare("INSERT INTO csv_import_test (id, value) VALUES (0, 'duplicate')"),
    ];

    await expect(runCsvAtomicBatch(db, statements)).rejects.toThrow();
    const count = await db.prepare("SELECT COUNT(*) AS count FROM csv_import_test").first<{
      count: number;
    }>();
    expect(count?.count).toBe(0);
  });
});
