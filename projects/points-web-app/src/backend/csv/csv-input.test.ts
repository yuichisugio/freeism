import { describe, expect, it } from "vite-plus/test";

import { CSV_MAX_BYTES, parseAndValidateCsv, revalidateCsvForCommit } from "./csv-input";
import { defineCsvSchema, textColumn, validatedAmountColumn } from "./csv-schema";

const encoder = new TextEncoder();
const schema = defineCsvSchema({
  importType: "TEST_FIX",
  columns: [
    textColumn("id", { maxCodePoints: 8 }),
    validatedAmountColumn("amount", { minimumUnit: "0.0001" }),
    textColumn("memo", { maxCodePoints: 5 }),
  ],
  businessKey: (row) => row.id ?? "",
});

function bytes(value: string) {
  return encoder.encode(value);
}

describe("strict CSV input", () => {
  it("accepts BOM, CRLF/LF, quoted newlines, Unicode and ignores empty records", async () => {
    const result = await parseAndValidateCsv(
      bytes('\uFEFFid,amount,memo\r\na,0.0001,"日\n本"\r\n\r\nb,-1.2500,ok\n,,\n'),
      schema,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { id: "a", amount: "0.0001", memo: "日\n本" },
      { id: "b", amount: "-1.2500", memo: "ok" },
    ]);
    expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.validationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts 0, 1,000 and rejects 1,001 non-empty data rows", async () => {
    const empty = await parseAndValidateCsv(bytes("id,amount,memo\n"), schema);
    expect(empty.rows).toHaveLength(0);
    expect(empty.errors).toEqual([]);

    const rows = Array.from({ length: 1_000 }, (_, index) => `i${index},1,`);
    const thousand = await parseAndValidateCsv(bytes(`id,amount,memo\n${rows.join("\n")}`), schema);
    expect(thousand.rows).toHaveLength(1_000);
    expect(thousand.errors).toEqual([]);

    const over = await parseAndValidateCsv(
      bytes(`id,amount,memo\n${[...rows, "extra,1,"].join("\n")}`),
      schema,
    );
    expect(over.errors).toContainEqual({
      code: "CSV_TOO_MANY_ROWS",
      column: null,
      row: 1_002,
    });
  });

  it("accepts exactly 5 MiB and rejects the next byte before parsing", async () => {
    const exact = new Uint8Array(CSV_MAX_BYTES);
    exact.set(bytes("id,amount,memo\n"));
    const exactResult = await parseAndValidateCsv(exact, schema);
    expect(exactResult.errors.some((error) => error.code === "CSV_FILE_TOO_LARGE")).toBe(false);

    const over = new Uint8Array(CSV_MAX_BYTES + 1);
    const overResult = await parseAndValidateCsv(over, schema);
    expect(overResult.errors).toEqual([{ code: "CSV_FILE_TOO_LARGE", column: null, row: 0 }]);
  });

  it("rejects malformed UTF-8 with a fatal decoder", async () => {
    const input = new Uint8Array([...bytes("id,amount,memo\n"), 0xc3, 0x28]);
    const result = await parseAndValidateCsv(input, schema);
    expect(result.errors).toEqual([{ code: "CSV_INVALID_UTF8", column: null, row: 0 }]);
  });

  it("rejects characters after a closing quote", async () => {
    const result = await parseAndValidateCsv(bytes('id,amount,memo\n"a"x,1,ok'), schema);
    expect(result.errors).toEqual([{ code: "CSV_MALFORMED", column: null, row: 0 }]);
  });

  it("keeps original record numbers when empty records are ignored", async () => {
    const result = await parseAndValidateCsv(bytes("id,amount,memo\n\na,1e3,ok"), schema);
    expect(result.errors).toContainEqual({
      code: "AMOUNT_INVALID_FORMAT",
      column: "amount",
      row: 3,
    });
  });

  it.each([
    ["id,id,memo", "CSV_HEADER_DUPLICATE", "id"],
    ["id,memo", "CSV_HEADER_MISSING", "amount"],
    ["id,amount,memo,extra", "CSV_HEADER_UNEXPECTED", "extra"],
    ["amount,id,memo", "CSV_HEADER_ORDER", "amount"],
  ])("rejects invalid header %s", async (header, code, column) => {
    const result = await parseAndValidateCsv(bytes(`${header}\n`), schema);
    expect(result.errors).toContainEqual({ code, column, row: 1 });
  });

  it("collects every cell error with row, column and code", async () => {
    const result = await parseAndValidateCsv(
      bytes("id,amount,memo\ntoolongid,1e3,abcdef\na,−1,ok\na,0.00001,ok"),
      schema,
    );

    expect(result.errors).toEqual([
      { code: "CSV_CELL_TOO_LONG", column: "id", row: 2 },
      { code: "AMOUNT_INVALID_FORMAT", column: "amount", row: 2 },
      { code: "CSV_CELL_TOO_LONG", column: "memo", row: 2 },
      { code: "AMOUNT_INVALID_FORMAT", column: "amount", row: 3 },
      { code: "CSV_DUPLICATE_BUSINESS_KEY", column: "id", row: 3 },
      { code: "AMOUNT_SCALE_EXCEEDED", column: "amount", row: 4 },
      { code: "CSV_DUPLICATE_BUSINESS_KEY", column: "id", row: 4 },
    ]);
  });

  it("produces deterministic validation hashes and rechecks both hashes on commit", async () => {
    const input = bytes("id,amount,memo\na,1,ok");
    const first = await parseAndValidateCsv(input, schema);
    const second = await parseAndValidateCsv(input, schema);
    expect(first.validationHash).toBe(second.validationHash);

    await expect(
      revalidateCsvForCommit(input, schema, {
        expectedFileHash: first.fileHash,
        expectedValidationHash: first.validationHash,
        assertAuthorized: () => undefined,
        assertReferencesCurrent: () => undefined,
      }),
    ).resolves.toEqual(first);

    await expect(
      revalidateCsvForCommit(input, schema, {
        expectedFileHash: "0".repeat(64),
        expectedValidationHash: first.validationHash,
        assertAuthorized: () => undefined,
        assertReferencesCurrent: () => undefined,
      }),
    ).rejects.toThrow("CSV_FILE_HASH_MISMATCH");
  });
});
