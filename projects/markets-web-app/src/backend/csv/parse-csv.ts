import { csvError, type CsvError } from "./csv-errors";

export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 1_000;

export type CsvByteInput = Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>;

export interface CsvParsedRow<Header extends string = string> {
  row: number;
  values: Record<Header, string>;
}

export interface CsvParseResult<Header extends string = string> {
  errors: readonly CsvError[];
  rows: readonly CsvParsedRow<Header>[];
}

class CsvSyntaxError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readBytes(input: CsvByteInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    if (input.byteLength > CSV_MAX_BYTES) throw new CsvSyntaxError("CSV_FILE_TOO_LARGE");
    return input;
  }
  if (input instanceof ArrayBuffer) {
    if (input.byteLength > CSV_MAX_BYTES) throw new CsvSyntaxError("CSV_FILE_TOO_LARGE");
    return new Uint8Array(input);
  }

  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > CSV_MAX_BYTES) {
      await reader.cancel();
      throw new CsvSyntaxError("CSV_FILE_TOO_LARGE");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

interface CsvRecord {
  row: number;
  values: string[];
}

function parseRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterClosingQuote = false;
  let atFieldStart = true;
  let line = 1;
  let recordStartLine = 1;

  const finishField = () => {
    record.push(field);
    field = "";
    afterClosingQuote = false;
    atFieldStart = true;
  };
  const finishRecord = () => {
    finishField();
    records.push({ row: recordStartLine, values: record });
    record = [];
    recordStartLine = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterClosingQuote = true;
          atFieldStart = false;
        }
      } else if (character === "\r" || character === "\n") {
        field += "\n";
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        line += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (afterClosingQuote && character !== "," && character !== "\r" && character !== "\n") {
      throw new CsvSyntaxError("CSV_MALFORMED");
    }

    if (character === '"') {
      if (!atFieldStart) throw new CsvSyntaxError("CSV_MALFORMED");
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
    } else {
      field += character;
      atFieldStart = false;
    }
  }

  if (quoted) throw new CsvSyntaxError("CSV_MALFORMED");
  if (field.length > 0 || record.length > 0 || afterClosingQuote) {
    finishRecord();
  }
  return records;
}

function validateHeader(actual: readonly string[], expected: readonly string[]): CsvError[] {
  const errors: CsvError[] = [];
  const seen = new Set<string>();
  for (const field of actual) {
    if (seen.has(field)) errors.push(csvError("CSV_HEADER_DUPLICATE", 1, field));
    seen.add(field);
  }
  for (const field of expected) {
    if (!actual.includes(field)) errors.push(csvError("CSV_HEADER_MISSING", 1, field));
  }
  for (const field of actual) {
    if (!expected.includes(field)) errors.push(csvError("CSV_HEADER_UNEXPECTED", 1, field));
  }
  if (errors.length === 0) {
    const mismatch = actual.findIndex((field, index) => field !== expected[index]);
    if (mismatch >= 0) errors.push(csvError("CSV_HEADER_ORDER", 1, actual[mismatch] ?? null));
  }
  return errors;
}

function fatalResult<Header extends string>(code: string): CsvParseResult<Header> {
  return { errors: [csvError(code, 0)], rows: [] };
}

export async function parseCsv<const Header extends string>(
  input: CsvByteInput,
  expectedHeaders: readonly Header[],
): Promise<CsvParseResult<Header>> {
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(input);
  } catch (caught) {
    if (caught instanceof CsvSyntaxError) return fatalResult(caught.code);
    throw caught;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return fatalResult("CSV_INVALID_UTF8");
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (text.includes("\uFEFF")) return fatalResult("CSV_UNEXPECTED_BOM");

  let records: CsvRecord[];
  try {
    records = parseRecords(text);
  } catch (caught) {
    if (caught instanceof CsvSyntaxError) return fatalResult(caught.code);
    throw caught;
  }

  const header = records.shift()?.values ?? [];
  const errors = validateHeader(header, expectedHeaders);
  const nonEmptyRecords = records.filter((record) => record.values.some((value) => value !== ""));
  if (nonEmptyRecords.length === 0) errors.push(csvError("CSV_NO_ROWS", 0));
  if (nonEmptyRecords.length > CSV_MAX_ROWS) {
    errors.push(csvError("CSV_TOO_MANY_ROWS", nonEmptyRecords[CSV_MAX_ROWS]?.row ?? 1_002));
  }

  const rows = nonEmptyRecords.map((record) => {
    if (record.values.length !== expectedHeaders.length) {
      errors.push(csvError("CSV_ROW_COLUMN_COUNT", record.row));
    }
    const values = Object.fromEntries(
      expectedHeaders.map((headerName, index) => [headerName, record.values[index] ?? ""]),
    ) as Record<Header, string>;
    return { row: record.row, values };
  });

  return { errors, rows };
}
