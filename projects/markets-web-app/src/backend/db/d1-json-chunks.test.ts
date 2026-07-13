import { describe, expect, it } from "vite-plus/test";

import {
  assertD1JsonBatchPlan,
  createCanonicalJsonChunks,
  MAX_D1_BATCH_STATEMENTS,
  MAX_D1_JSON_CHUNK_BYTES,
} from "./d1-json-chunks";

const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;

describe("D1 canonical JSON chunks", () => {
  it("sorts object keys recursively and preserves array order", () => {
    const chunks = createCanonicalJsonChunks([
      { z: 1, a: { y: 2, b: 3 }, values: [{ z: 4, a: 5 }, null] },
    ]);
    expect(chunks).toEqual(['[{"a":{"b":3,"y":2},"values":[{"a":5,"z":4},null],"z":1}]']);
  });

  it("accepts the exact 1,500,000-byte boundary", () => {
    const value = "x".repeat(MAX_D1_JSON_CHUNK_BYTES - 14);
    const [chunk] = createCanonicalJsonChunks([{ value }]);
    expect(byteLength(chunk ?? "")).toBe(MAX_D1_JSON_CHUNK_BYTES);
  });

  it("splits before exceeding the byte limit and never emits an empty chunk", () => {
    const rows = [
      { id: "a", value: "あ".repeat(300_000) },
      { id: "b", value: "い".repeat(300_000) },
    ];
    const chunks = createCanonicalJsonChunks(rows);
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => byteLength(chunk) <= MAX_D1_JSON_CHUNK_BYTES)).toBe(true);
    expect(chunks.map((chunk) => JSON.parse(chunk))).toEqual([[rows[0]], [rows[1]]]);
    expect(createCanonicalJsonChunks([])).toEqual([]);
  });

  it("rejects a single row beyond the chunk limit, including rows over 2 MiB", () => {
    expect(() =>
      createCanonicalJsonChunks([{ value: "x".repeat(MAX_D1_JSON_CHUNK_BYTES) }]),
    ).toThrow("D1_JSON_ROW_TOO_LARGE");
    expect(() => createCanonicalJsonChunks([{ value: "x".repeat(2 * 1024 * 1024) }])).toThrow(
      "D1_JSON_ROW_TOO_LARGE",
    );
  });

  it("rejects unsupported non-JSON values instead of changing canonical data", () => {
    expect(() => createCanonicalJsonChunks([{ value: undefined }])).toThrow(
      "INVALID_CANONICAL_JSON",
    );
    expect(() => createCanonicalJsonChunks([{ value: Number.NaN }])).toThrow(
      "INVALID_CANONICAL_JSON",
    );
  });

  it("accepts a one-parameter fixed SQL plan up to 40 statements", () => {
    const result = assertD1JsonBatchPlan({
      chunkCount: 9,
      fixedStatementCount: 4,
      sqlTemplates: [
        "INSERT INTO auctions SELECT json_extract(value, '$.id') FROM json_each(?)",
        "INSERT INTO auction_revisions SELECT json_extract(value, '$.id') FROM json_each(?)",
        "INSERT INTO point_package_snapshots SELECT json_extract(value, '$.id') FROM json_each(?)",
        "INSERT INTO audit_events SELECT json_extract(value, '$.id') FROM json_each(?)",
      ],
    });
    expect(result.statementCount).toBe(MAX_D1_BATCH_STATEMENTS);
    expect(result.boundParametersPerStatement).toBe(1);
  });

  it("rejects more than 40 statements, multiple parameters, or 100KB SQL", () => {
    expect(() =>
      assertD1JsonBatchPlan({
        chunkCount: 10,
        fixedStatementCount: 1,
        sqlTemplates: [
          "INSERT INTO auctions SELECT value FROM json_each(?)",
          "INSERT INTO audit_events SELECT value FROM json_each(?)",
          "INSERT INTO bid_events SELECT value FROM json_each(?)",
          "INSERT INTO auction_revisions SELECT value FROM json_each(?)",
        ],
      }),
    ).toThrow("D1_STATEMENT_LIMIT_EXCEEDED");
    expect(() =>
      assertD1JsonBatchPlan({
        chunkCount: 1,
        fixedStatementCount: 0,
        sqlTemplates: ["SELECT * FROM json_each(?) JOIN json_each(?)"],
      }),
    ).toThrow("D1_JSON_STATEMENT_PARAMETER_INVALID");
    expect(() =>
      assertD1JsonBatchPlan({
        chunkCount: 1,
        fixedStatementCount: 0,
        sqlTemplates: [`SELECT '${"x".repeat(100_000)}' FROM json_each(?)`],
      }),
    ).toThrow("D1_SQL_TOO_LARGE");
  });
});
