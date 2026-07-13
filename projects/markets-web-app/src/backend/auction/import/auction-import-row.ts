import { csvError, type CsvError } from "../../csv/csv-errors";
import type { CsvParsedRow } from "../../csv/parse-csv";

export const AUCTION_IMPORT_HEADERS = [
  "clientRowId",
  "title",
  "description",
  "externalUrl",
  "pointPackageId",
  "pointPackageRevisionId",
  "quantity",
  "startsAt",
  "endsAt",
  "buyNowPriceTickCount",
  "extensionThresholdSeconds",
  "extensionDurationSeconds",
  "maxExtensions",
] as const;

type AuctionImportHeader = (typeof AUCTION_IMPORT_HEADERS)[number];
export type RawAuctionImportRow = Record<AuctionImportHeader, string>;

export interface AuctionImportRow {
  clientRowId: string;
  title: string;
  description: string;
  externalUrl: string;
  pointPackageId: string;
  pointPackageRevisionId: string;
  quantity: number;
  startsAt: string;
  endsAt: string;
  buyNowPriceTickCount: number | null;
  extensionThresholdSeconds: number | null;
  extensionDurationSeconds: number | null;
  maxExtensions: number | null;
}

export interface AuctionImportRowsResult {
  errors: readonly CsvError[];
  rows: readonly AuctionImportRow[];
}

const encoder = new TextEncoder();
const UTC_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const UNSAFE_PERCENT_ENCODING = /%(?![0-9a-fA-F]{2})/;

function codePointLength(value: string): number {
  return [...value].length;
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function hasDisallowedControl(value: string, allowTabAndLf: boolean): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (allowTabAndLf && (codePoint === 9 || codePoint === 10)) return false;
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });
}

function normalizePercentEncoding(value: string): string {
  return value.replace(/%[0-9a-fA-F]{2}/g, (encoded) => {
    const octet = Number.parseInt(encoded.slice(1), 16);
    const unreserved =
      (octet >= 0x41 && octet <= 0x5a) ||
      (octet >= 0x61 && octet <= 0x7a) ||
      (octet >= 0x30 && octet <= 0x39) ||
      octet === 0x2d ||
      octet === 0x2e ||
      octet === 0x5f ||
      octet === 0x7e;
    return unreserved ? String.fromCharCode(octet) : `%${encoded.slice(1).toUpperCase()}`;
  });
}

function normalizeExternalUrl(value: string): string | null {
  if (/\p{Cc}/u.test(value) || UNSAFE_PERCENT_ENCODING.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.hostname === "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    return null;
  }
  const canonical = normalizePercentEncoding(url.href);
  return byteLength(canonical) <= 2_048 ? canonical : null;
}

function parsePositiveSafeInteger(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizeUtcDateTime(value: string): string | null {
  if (!UTC_DATE_TIME.test(value)) return null;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return null;
  const canonical = new Date(epoch).toISOString();
  const withoutMilliseconds = canonical.replace(".000Z", "Z");
  const milliseconds = value.match(/\.(\d{1,3})Z$/)?.[1];
  if (milliseconds === undefined) return value === withoutMilliseconds ? canonical : null;
  const paddedInput = value.replace(
    /\.(\d{1,3})Z$/,
    (_, digits: string) => `.${digits.padEnd(3, "0")}Z`,
  );
  return paddedInput === canonical ? canonical : null;
}

function requiredIdentifier(
  value: string,
  row: number,
  field: AuctionImportHeader,
  errors: CsvError[],
): string {
  const normalized = value.trim();
  if (normalized.length === 0) errors.push(csvError("AUCTION_FIELD_REQUIRED", row, field));
  return normalized;
}

function normalizeRow(input: CsvParsedRow<AuctionImportHeader>): {
  errors: CsvError[];
  row: AuctionImportRow;
} {
  const errors: CsvError[] = [];
  const values = input.values;
  const title = values.title.normalize("NFC").trim();
  const description = values.description.replace(/\r\n?/g, "\n").normalize("NFC");
  const externalUrl = normalizeExternalUrl(values.externalUrl);

  if (title.length === 0) errors.push(csvError("AUCTION_TITLE_REQUIRED", input.row, "title"));
  else if (hasDisallowedControl(title, false)) {
    errors.push(csvError("AUCTION_TITLE_CONTROL_CHARACTER", input.row, "title"));
  } else if (codePointLength(title) > 120 || byteLength(title) > 480) {
    errors.push(csvError("AUCTION_TITLE_TOO_LONG", input.row, "title"));
  }

  if (description.length === 0) {
    errors.push(csvError("AUCTION_DESCRIPTION_REQUIRED", input.row, "description"));
  } else if (hasDisallowedControl(description, true)) {
    errors.push(csvError("AUCTION_DESCRIPTION_CONTROL_CHARACTER", input.row, "description"));
  } else if (codePointLength(description) > 4_000 || byteLength(description) > 16_000) {
    errors.push(csvError("AUCTION_DESCRIPTION_TOO_LONG", input.row, "description"));
  }

  if (externalUrl === null) {
    errors.push(csvError("AUCTION_EXTERNAL_URL_INVALID", input.row, "externalUrl"));
  }

  const quantity = parsePositiveSafeInteger(values.quantity);
  if (quantity === null) {
    errors.push(
      csvError(
        /^\d+$/.test(values.quantity)
          ? "AUCTION_QUANTITY_OUT_OF_RANGE"
          : "AUCTION_QUANTITY_INVALID",
        input.row,
        "quantity",
      ),
    );
  } else if (quantity > 1_000) {
    errors.push(csvError("AUCTION_QUANTITY_OUT_OF_RANGE", input.row, "quantity"));
  }

  const startsAt = normalizeUtcDateTime(values.startsAt);
  const endsAt = normalizeUtcDateTime(values.endsAt);
  if (startsAt === null) errors.push(csvError("AUCTION_DATETIME_INVALID", input.row, "startsAt"));
  if (endsAt === null) errors.push(csvError("AUCTION_DATETIME_INVALID", input.row, "endsAt"));
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    errors.push(csvError("AUCTION_ENDS_AT_NOT_AFTER_START", input.row, "endsAt"));
  }

  let buyNowPriceTickCount: number | null = null;
  if (values.buyNowPriceTickCount !== "") {
    buyNowPriceTickCount = parsePositiveSafeInteger(values.buyNowPriceTickCount);
    if (buyNowPriceTickCount === null) {
      errors.push(csvError("AUCTION_TICK_COUNT_OUT_OF_RANGE", input.row, "buyNowPriceTickCount"));
    }
  }

  const extensionFields = [
    "extensionThresholdSeconds",
    "extensionDurationSeconds",
    "maxExtensions",
  ] as const;
  const populatedExtensionFields = extensionFields.filter((field) => values[field] !== "");
  if (
    populatedExtensionFields.length > 0 &&
    populatedExtensionFields.length < extensionFields.length
  ) {
    for (const field of extensionFields) {
      if (values[field] === "") {
        errors.push(csvError("AUCTION_EXTENSION_ALL_OR_NONE", input.row, field));
      }
    }
  }

  const parsedExtensions = extensionFields.map((field) =>
    values[field] === "" ? null : parsePositiveSafeInteger(values[field]),
  );
  for (const [index, parsed] of parsedExtensions.entries()) {
    if (values[extensionFields[index]!] !== "" && parsed === null) {
      errors.push(csvError("AUCTION_EXTENSION_VALUE_INVALID", input.row, extensionFields[index]!));
    }
  }

  return {
    errors,
    row: {
      clientRowId: requiredIdentifier(values.clientRowId, input.row, "clientRowId", errors),
      title,
      description,
      externalUrl: externalUrl ?? values.externalUrl,
      pointPackageId: requiredIdentifier(
        values.pointPackageId,
        input.row,
        "pointPackageId",
        errors,
      ),
      pointPackageRevisionId: requiredIdentifier(
        values.pointPackageRevisionId,
        input.row,
        "pointPackageRevisionId",
        errors,
      ),
      quantity: quantity ?? 0,
      startsAt: startsAt ?? values.startsAt,
      endsAt: endsAt ?? values.endsAt,
      buyNowPriceTickCount,
      extensionThresholdSeconds: parsedExtensions[0] ?? null,
      extensionDurationSeconds: parsedExtensions[1] ?? null,
      maxExtensions: parsedExtensions[2] ?? null,
    },
  };
}

export function normalizeAuctionImportRows(
  inputs: readonly CsvParsedRow<AuctionImportHeader>[],
): AuctionImportRowsResult {
  const normalized = inputs.map(normalizeRow);
  const errors = normalized.flatMap((result) => result.errors);
  const clientRowCounts = new Map<string, number>();
  for (const result of normalized) {
    const key = result.row.clientRowId;
    clientRowCounts.set(key, (clientRowCounts.get(key) ?? 0) + 1);
  }
  for (const [index, result] of normalized.entries()) {
    if ((clientRowCounts.get(result.row.clientRowId) ?? 0) > 1) {
      errors.push(csvError("CSV_DUPLICATE_CLIENT_ROW_ID", inputs[index]!.row, "clientRowId"));
    }
  }
  return { errors, rows: errors.length === 0 ? normalized.map((result) => result.row) : [] };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integerField(value: unknown): string {
  return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "invalid";
}

function optionalIntegerField(value: unknown): string {
  return value === null ? "" : integerField(value);
}

/** Reuses the CSV field rules for JSON commit and PATCH payloads. */
export function revalidateAuctionImportRows(inputs: readonly unknown[]): AuctionImportRowsResult {
  return normalizeAuctionImportRows(
    inputs.map((input, index) => {
      const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      return {
        row: index + 2,
        values: {
          clientRowId: stringField(row.clientRowId),
          title: stringField(row.title),
          description: stringField(row.description),
          externalUrl: stringField(row.externalUrl),
          pointPackageId: stringField(row.pointPackageId),
          pointPackageRevisionId: stringField(row.pointPackageRevisionId),
          quantity: integerField(row.quantity),
          startsAt: stringField(row.startsAt),
          endsAt: stringField(row.endsAt),
          buyNowPriceTickCount: optionalIntegerField(row.buyNowPriceTickCount),
          extensionThresholdSeconds: optionalIntegerField(row.extensionThresholdSeconds),
          extensionDurationSeconds: optionalIntegerField(row.extensionDurationSeconds),
          maxExtensions: optionalIntegerField(row.maxExtensions),
        },
      };
    }),
  );
}
