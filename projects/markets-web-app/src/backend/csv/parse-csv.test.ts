import { describe, expect, it } from "vite-plus/test";

import {
  AUCTION_IMPORT_HEADERS,
  normalizeAuctionImportRows,
} from "../auction/import/auction-import-row";
import { CSV_MAX_BYTES, parseCsv } from "./parse-csv";

const encoder = new TextEncoder();

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function csvRow(overrides: Partial<Record<(typeof AUCTION_IMPORT_HEADERS)[number], string>> = {}) {
  const row: Record<(typeof AUCTION_IMPORT_HEADERS)[number], string> = {
    clientRowId: "row-1",
    title: "Auction title",
    description: "Auction description",
    externalUrl: "https://example.com/items/1",
    pointPackageId: "package-1",
    pointPackageRevisionId: "package-revision-1",
    quantity: "1",
    startsAt: "2027-01-01T00:00:00Z",
    endsAt: "2027-01-02T00:00:00Z",
    buyNowPriceTickCount: "",
    extensionThresholdSeconds: "",
    extensionDurationSeconds: "",
    maxExtensions: "",
    ...overrides,
  };
  return AUCTION_IMPORT_HEADERS.map((header) => row[header]).join(",");
}

async function parseAuctionCsv(rows: readonly string[]) {
  const parsed = await parseCsv(
    bytes(`${AUCTION_IMPORT_HEADERS.join(",")}\n${rows.join("\n")}`),
    AUCTION_IMPORT_HEADERS,
  );
  const normalized = normalizeAuctionImportRows(parsed.rows);
  return { errors: [...parsed.errors, ...normalized.errors], rows: normalized.rows };
}

describe("parseCsv", () => {
  it("accepts one leading BOM, CRLF and LF, and quoted newlines", async () => {
    const csv =
      "\uFEFFclientRowId,title,description,externalUrl,pointPackageId,pointPackageRevisionId,quantity,startsAt,endsAt,buyNowPriceTickCount,extensionThresholdSeconds,extensionDurationSeconds,maxExtensions\r\n" +
      'row-1,title,"line 1\r\nline 2",https://example.com,package-1,revision-1,1,2027-01-01T00:00:00Z,2027-01-02T00:00:00Z,,,,\n';

    const result = await parseCsv(bytes(csv), AUCTION_IMPORT_HEADERS);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        row: 2,
        values: expect.objectContaining({ description: "line 1\nline 2" }),
      }),
    ]);
  });

  it("rejects malformed UTF-8 with fatal decoding", async () => {
    const input = new Uint8Array([...bytes(`${AUCTION_IMPORT_HEADERS.join(",")}\n`), 0xc3, 0x28]);

    const result = await parseCsv(input, AUCTION_IMPORT_HEADERS);

    expect(result.errors).toEqual([{ code: "CSV_INVALID_UTF8", field: null, row: 0 }]);
  });

  it("rejects a second or embedded BOM", async () => {
    const result = await parseCsv(
      bytes(`\uFEFF\uFEFF${AUCTION_IMPORT_HEADERS.join(",")}\n${csvRow()}`),
      AUCTION_IMPORT_HEADERS,
    );

    expect(result.errors).toEqual([{ code: "CSV_UNEXPECTED_BOM", field: null, row: 0 }]);
  });

  it.each([
    [
      "duplicate",
      [...AUCTION_IMPORT_HEADERS.slice(0, -1), "clientRowId"],
      "CSV_HEADER_DUPLICATE",
      "clientRowId",
    ],
    ["missing", AUCTION_IMPORT_HEADERS.slice(0, -1), "CSV_HEADER_MISSING", "maxExtensions"],
    ["unexpected", [...AUCTION_IMPORT_HEADERS, "other"], "CSV_HEADER_UNEXPECTED", "other"],
    [
      "order",
      [AUCTION_IMPORT_HEADERS[1], AUCTION_IMPORT_HEADERS[0], ...AUCTION_IMPORT_HEADERS.slice(2)],
      "CSV_HEADER_ORDER",
      "title",
    ],
  ] as const)("rejects a %s header", async (_label, header, code, field) => {
    const result = await parseCsv(bytes(`${header.join(",")}\n`), AUCTION_IMPORT_HEADERS);

    expect(result.errors).toContainEqual({ code, field, row: 1 });
  });

  it("requires 1 to 1,000 non-empty data rows", async () => {
    const empty = await parseCsv(
      bytes(`${AUCTION_IMPORT_HEADERS.join(",")}\n`),
      AUCTION_IMPORT_HEADERS,
    );
    expect(empty.errors).toContainEqual({ code: "CSV_NO_ROWS", field: null, row: 0 });

    const thousandRows = Array.from({ length: 1_000 }, (_, index) =>
      csvRow({ clientRowId: `row-${index}` }),
    );
    const thousand = await parseCsv(
      bytes(`${AUCTION_IMPORT_HEADERS.join(",")}\n${thousandRows.join("\n")}`),
      AUCTION_IMPORT_HEADERS,
    );
    expect(thousand.errors).toEqual([]);
    expect(thousand.rows).toHaveLength(1_000);

    const over = await parseCsv(
      bytes(`${AUCTION_IMPORT_HEADERS.join(",")}\n${[...thousandRows, csvRow()].join("\n")}`),
      AUCTION_IMPORT_HEADERS,
    );
    expect(over.errors).toContainEqual({ code: "CSV_TOO_MANY_ROWS", field: null, row: 1_002 });
  });

  it("accepts exactly 5 MiB and rejects the next byte before parsing", async () => {
    const exact = new Uint8Array(CSV_MAX_BYTES);
    exact.set(bytes(`${AUCTION_IMPORT_HEADERS.join(",")}\n${csvRow()}`));
    const exactResult = await parseCsv(exact, AUCTION_IMPORT_HEADERS);
    expect(exactResult.errors).not.toContainEqual({
      code: "CSV_FILE_TOO_LARGE",
      field: null,
      row: 0,
    });

    const over = new Uint8Array(CSV_MAX_BYTES + 1);
    const overResult = await parseCsv(over, AUCTION_IMPORT_HEADERS);
    expect(overResult.errors).toEqual([{ code: "CSV_FILE_TOO_LARGE", field: null, row: 0 }]);
  });

  it("reports a wrong cell count at the original physical row", async () => {
    const input = `${AUCTION_IMPORT_HEADERS.join(",")}\n\n${csvRow().replace(/,$/, "")}`;
    const result = await parseCsv(bytes(input), AUCTION_IMPORT_HEADERS);

    expect(result.errors).toContainEqual({ code: "CSV_ROW_COLUMN_COUNT", field: null, row: 3 });
  });
});

describe("normalizeAuctionImportRows", () => {
  it("normalizes title, description, URL and UTC timestamps", async () => {
    const result = await parseAuctionCsv([
      csvRow({
        title: "  Cafe\u0301  ",
        description: '"line 1\r\nline 2"',
        externalUrl: "https://EXAMPLE.com:443/a/../%7eitem",
        startsAt: "2027-01-01T00:00:00.000Z",
        endsAt: "2027-01-02T00:00:00.000Z",
      }),
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        title: "Café",
        description: "line 1\nline 2",
        externalUrl: "https://example.com/~item",
        startsAt: "2027-01-01T00:00:00.000Z",
        endsAt: "2027-01-02T00:00:00.000Z",
      }),
    ]);
  });

  it.each([
    ["title empty", { title: "" }, "title", "AUCTION_TITLE_REQUIRED"],
    ["title control", { title: '"bad\ntitle"' }, "title", "AUCTION_TITLE_CONTROL_CHARACTER"],
    ["description empty", { description: "" }, "description", "AUCTION_DESCRIPTION_REQUIRED"],
    [
      "description control",
      { description: "bad\u0001description" },
      "description",
      "AUCTION_DESCRIPTION_CONTROL_CHARACTER",
    ],
    [
      "URL protocol",
      { externalUrl: "http://example.com" },
      "externalUrl",
      "AUCTION_EXTERNAL_URL_INVALID",
    ],
    [
      "URL userinfo",
      { externalUrl: "https://user@example.com" },
      "externalUrl",
      "AUCTION_EXTERNAL_URL_INVALID",
    ],
    [
      "URL fragment",
      { externalUrl: "https://example.com/#x" },
      "externalUrl",
      "AUCTION_EXTERNAL_URL_INVALID",
    ],
    ["quantity zero", { quantity: "0" }, "quantity", "AUCTION_QUANTITY_OUT_OF_RANGE"],
    ["quantity decimal", { quantity: "1.5" }, "quantity", "AUCTION_QUANTITY_INVALID"],
    [
      "non UTC start",
      { startsAt: "2027-01-01T00:00:00+09:00" },
      "startsAt",
      "AUCTION_DATETIME_INVALID",
    ],
    [
      "end before start",
      { endsAt: "2026-12-31T23:59:59Z" },
      "endsAt",
      "AUCTION_ENDS_AT_NOT_AFTER_START",
    ],
    [
      "buy now zero",
      { buyNowPriceTickCount: "0" },
      "buyNowPriceTickCount",
      "AUCTION_TICK_COUNT_OUT_OF_RANGE",
    ],
  ] as const)("rejects %s", async (_label, overrides, field, code) => {
    const result = await parseAuctionCsv([csvRow(overrides)]);

    expect(result.errors).toContainEqual({ code, field, row: 2 });
  });

  it("enforces title and description code point and UTF-8 byte limits", async () => {
    const result = await parseAuctionCsv([
      csvRow({ clientRowId: "title-code-points", title: "a".repeat(121) }),
      csvRow({ clientRowId: "title-bytes", title: "😀".repeat(121) }),
      csvRow({ clientRowId: "description-code-points", description: "a".repeat(4_001) }),
      csvRow({ clientRowId: "description-bytes", description: "😀".repeat(4_001) }),
    ]);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        { code: "AUCTION_TITLE_TOO_LONG", field: "title", row: 2 },
        { code: "AUCTION_TITLE_TOO_LONG", field: "title", row: 3 },
        { code: "AUCTION_DESCRIPTION_TOO_LONG", field: "description", row: 4 },
        { code: "AUCTION_DESCRIPTION_TOO_LONG", field: "description", row: 5 },
      ]),
    );
  });

  it("requires all extension columns together and parses safe integers", async () => {
    const incomplete = await parseAuctionCsv([
      csvRow({ extensionThresholdSeconds: "30", extensionDurationSeconds: "60" }),
    ]);
    expect(incomplete.errors).toContainEqual({
      code: "AUCTION_EXTENSION_ALL_OR_NONE",
      field: "maxExtensions",
      row: 2,
    });

    const complete = await parseAuctionCsv([
      csvRow({
        buyNowPriceTickCount: "10",
        extensionThresholdSeconds: "30",
        extensionDurationSeconds: "60",
        maxExtensions: "3",
      }),
    ]);
    expect(complete.errors).toEqual([]);
    expect(complete.rows[0]).toEqual(
      expect.objectContaining({
        buyNowPriceTickCount: 10,
        extensionThresholdSeconds: 30,
        extensionDurationSeconds: 60,
        maxExtensions: 3,
        quantity: 1,
      }),
    );
  });

  it("rejects every duplicate clientRowId", async () => {
    const result = await parseAuctionCsv([
      csvRow({ clientRowId: "duplicate" }),
      csvRow({ clientRowId: "duplicate", title: "second" }),
    ]);

    expect(result.errors).toEqual([
      { code: "CSV_DUPLICATE_CLIENT_ROW_ID", field: "clientRowId", row: 2 },
      { code: "CSV_DUPLICATE_CLIENT_ROW_ID", field: "clientRowId", row: 3 },
    ]);
    expect(result.rows).toEqual([]);
  });
});
