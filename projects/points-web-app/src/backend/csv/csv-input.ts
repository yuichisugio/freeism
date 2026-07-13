import type { CsvSchema } from "./csv-schema";
import {
  canonicalJson,
  sha256Hex,
  type CsvValidationError,
  type CsvValidationResult,
} from "./csv-validation-result";

export const CSV_MAX_BYTES = 5 * 1024 * 1024;

type CsvByteInput = Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>;

class CsvInputError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readBytes(input: CsvByteInput): Promise<Uint8Array> {
  if (input instanceof ArrayBuffer) {
    if (input.byteLength > CSV_MAX_BYTES) throw new CsvInputError("CSV_FILE_TOO_LARGE");
    return new Uint8Array(input);
  }
  if (input instanceof Uint8Array) {
    if (input.byteLength > CSV_MAX_BYTES) throw new CsvInputError("CSV_FILE_TOO_LARGE");
    return input;
  }

  const reader = input.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > CSV_MAX_BYTES) {
      await reader.cancel();
      throw new CsvInputError("CSV_FILE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterClosingQuote = false;
  let atFieldStart = true;

  const finishField = () => {
    record.push(field);
    field = "";
    afterClosingQuote = false;
    atFieldStart = true;
  };
  const finishRecord = () => {
    finishField();
    records.push(record);
    record = [];
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
      } else if (character === "\r") {
        field += "\n";
        if (text[index + 1] === "\n") index += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (afterClosingQuote && character !== "," && character !== "\n" && character !== "\r") {
      throw new CsvInputError("CSV_MALFORMED");
    }

    if (character === '"') {
      if (!atFieldStart) throw new CsvInputError("CSV_MALFORMED");
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n" || character === "\r") {
      finishRecord();
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      if (!atFieldStart && field.length === 0) throw new CsvInputError("CSV_MALFORMED");
      field += character;
      atFieldStart = false;
    }
  }
  if (quoted) throw new CsvInputError("CSV_MALFORMED");
  if (field.length > 0 || record.length > 0 || afterClosingQuote) finishRecord();
  return records;
}

function error(code: string, row: number, column: string | null = null): CsvValidationError {
  return { code, column, row };
}

function validateHeader(actual: string[], expected: readonly string[]): CsvValidationError[] {
  const errors: CsvValidationError[] = [];
  const seen = new Set<string>();
  for (const column of actual) {
    if (seen.has(column)) errors.push(error("CSV_HEADER_DUPLICATE", 1, column));
    seen.add(column);
  }
  for (const column of expected) {
    if (!actual.includes(column)) errors.push(error("CSV_HEADER_MISSING", 1, column));
  }
  for (const column of actual) {
    if (!expected.includes(column)) errors.push(error("CSV_HEADER_UNEXPECTED", 1, column));
  }
  if (errors.length === 0 && actual.some((column, index) => column !== expected[index])) {
    const mismatchIndex = actual.findIndex((column, index) => column !== expected[index]);
    errors.push(error("CSV_HEADER_ORDER", 1, actual[mismatchIndex] ?? null));
  }
  return errors;
}

async function resultForError<Row extends Record<string, string>>(
  code: string,
): Promise<CsvValidationResult<Row>> {
  const errors = [error(code, 0)];
  return {
    fileHash: "",
    validationHash: await sha256Hex(canonicalJson({ errors, rows: [] })),
    rows: [],
    errors,
  };
}

export async function parseAndValidateCsv<Row extends Record<string, string>>(
  input: CsvByteInput,
  schema: CsvSchema<Row>,
): Promise<CsvValidationResult<Row>> {
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(input);
  } catch (caught) {
    if (caught instanceof CsvInputError) return resultForError<Row>(caught.code);
    throw caught;
  }

  const fileHash = await sha256Hex(bytes);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    const invalid = await resultForError<Row>("CSV_INVALID_UTF8");
    return { ...invalid, fileHash };
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (text.includes("\uFEFF")) {
    const invalid = await resultForError<Row>("CSV_UNEXPECTED_BOM");
    return { ...invalid, fileHash };
  }

  let records: string[][];
  try {
    records = parseRecords(text);
  } catch (caught) {
    if (!(caught instanceof CsvInputError)) throw caught;
    const invalid = await resultForError<Row>(caught.code);
    return { ...invalid, fileHash };
  }

  const expectedHeader = schema.columns.map((column) => column.name);
  const header = records.shift() ?? [];
  const errors = validateHeader(header, expectedHeader);
  const nonEmptyRecords = records
    .map((record, index) => ({ record, rowNumber: index + 2 }))
    .filter(({ record }) => record.some((cell) => cell !== ""));
  if (nonEmptyRecords.length > schema.maxRows) {
    errors.push(
      error("CSV_TOO_MANY_ROWS", nonEmptyRecords[schema.maxRows]?.rowNumber ?? schema.maxRows + 2),
    );
  }

  const candidates = nonEmptyRecords.map(({ record, rowNumber }) => {
    const row = Object.fromEntries(
      schema.columns.map((column, columnIndex) => [column.name, record[columnIndex] ?? ""]),
    ) as Row;
    return { record, row, rowNumber };
  });
  const businessKeyCounts = new Map<string, number>();
  if (schema.businessKey) {
    for (const candidate of candidates) {
      const key = schema.businessKey(candidate.row);
      businessKeyCounts.set(key, (businessKeyCounts.get(key) ?? 0) + 1);
    }
  }

  for (const candidate of candidates) {
    if (candidate.record.length !== schema.columns.length) {
      errors.push(error("CSV_ROW_COLUMN_COUNT", candidate.rowNumber));
    }
    for (const column of schema.columns) {
      const value = candidate.row[column.name] ?? "";
      if ([...value].length > column.maxCodePoints) {
        errors.push(error("CSV_CELL_TOO_LONG", candidate.rowNumber, column.name));
      }
      for (const code of column.validate(value)) {
        errors.push(error(code, candidate.rowNumber, column.name));
      }
    }
    if (schema.businessKey) {
      const key = schema.businessKey(candidate.row);
      if ((businessKeyCounts.get(key) ?? 0) > 1) {
        errors.push(
          error("CSV_DUPLICATE_BUSINESS_KEY", candidate.rowNumber, schema.columns[0]?.name ?? null),
        );
      }
    }
  }

  const rows = candidates.map((candidate) => candidate.row);
  const validationHash = await sha256Hex(
    canonicalJson({ errors, importType: schema.importType, rows }),
  );
  return { errors, fileHash, rows, validationHash };
}

interface RevalidationOptions {
  expectedFileHash: string;
  expectedValidationHash: string;
  assertAuthorized(): void | Promise<void>;
  assertReferencesCurrent(): void | Promise<void>;
}

export async function revalidateCsvForCommit<Row extends Record<string, string>>(
  input: CsvByteInput,
  schema: CsvSchema<Row>,
  options: RevalidationOptions,
): Promise<CsvValidationResult<Row>> {
  await options.assertAuthorized();
  const result = await parseAndValidateCsv(input, schema);
  if (result.fileHash !== options.expectedFileHash) throw new Error("CSV_FILE_HASH_MISMATCH");
  if (result.validationHash !== options.expectedValidationHash) {
    throw new Error("CSV_VALIDATION_HASH_MISMATCH");
  }
  if (result.errors.length > 0) throw new Error("CSV_VALIDATION_FAILED");
  await options.assertReferencesCurrent();
  return result;
}
