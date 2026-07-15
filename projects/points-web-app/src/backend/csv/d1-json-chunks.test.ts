import { describe, expect, it, vi } from "vite-plus/test";

import {
  CSV_JSON_CHUNK_MAX_BYTES,
  chunkCanonicalJsonRows,
  composeCsvAtomicBatch,
  prepareJsonEachStatements,
} from "./d1-json-chunks";

describe("D1 canonical JSON chunks", () => {
  it("keeps every chunk at or below 1,500,000 UTF-8 bytes and preserves rows", () => {
    const rows = [
      { id: "a", value: "x".repeat(CSV_JSON_CHUNK_MAX_BYTES - 40) },
      { id: "b", value: "日本語" },
    ];
    const chunks = chunkCanonicalJsonRows(rows);

    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(new TextEncoder().encode(chunk).byteLength).toBeLessThanOrEqual(
        CSV_JSON_CHUNK_MAX_BYTES,
      );
    }
    expect(chunks.flatMap((chunk) => JSON.parse(chunk))).toEqual(rows);
  });

  it("rejects a single canonical row over 2 MB", () => {
    expect(() => chunkCanonicalJsonRows([{ value: "x".repeat(2_000_001) }])).toThrow(
      "CSV_ROW_JSON_TOO_LARGE",
    );
  });

  it("uses fixed SQL under 100 KB with json_each(?) and one parameter per chunk", () => {
    const bind = vi.fn(() => ({ statement: true }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const chunks = ["[]", '[{"id":"a"}]'];
    const sql = "INSERT INTO csv_test (id) SELECT json_extract(value, '$.id') FROM json_each(?)";

    const statements = prepareJsonEachStatements(db, sql, chunks);
    expect(statements).toHaveLength(2);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(bind.mock.calls).toEqual([[chunks[0]], [chunks[1]]]);
    expect(new TextEncoder().encode(sql).byteLength).toBeLessThan(100_000);
  });

  it("composes command guard, chunks, result, writes, ledger and audit in at most 100 statements", () => {
    const statement = {} as D1PreparedStatement;
    const batch = composeCsvAtomicBatch({
      commandGuard: [statement],
      chunkWrites: Array.from({ length: 94 }, () => statement),
      idempotencyResult: [statement],
      domainWrites: [statement],
      ledger: [statement],
      audit: [statement],
    });
    expect(batch).toHaveLength(99);

    expect(() =>
      composeCsvAtomicBatch({
        commandGuard: [statement],
        chunkWrites: Array.from({ length: 96 }, () => statement),
        idempotencyResult: [statement],
        domainWrites: [statement],
        ledger: [statement],
        audit: [statement],
      }),
    ).toThrow("CSV_D1_STATEMENT_LIMIT_EXCEEDED");
  });
});
