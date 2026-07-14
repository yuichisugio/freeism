import { canonicalJson } from "./csv-validation-result";

export const CSV_JSON_CHUNK_MAX_BYTES = 1_500_000;
export const CSV_JSON_ROW_MAX_BYTES = 2_000_000;
export const CSV_D1_SQL_MAX_BYTES = 100_000;
export const CSV_D1_STATEMENT_MAX = 100;

const encoder = new TextEncoder();

export function chunkCanonicalJsonRows(
  rows: readonly unknown[],
  maxBytes = CSV_JSON_CHUNK_MAX_BYTES,
): string[] {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 2 || maxBytes > CSV_JSON_CHUNK_MAX_BYTES) {
    throw new Error("CSV_JSON_CHUNK_LIMIT_INVALID");
  }
  const chunks: string[] = [];
  let parts: string[] = [];
  let bytes = 2;

  const flush = () => {
    if (parts.length > 0) chunks.push(`[${parts.join(",")}]`);
    parts = [];
    bytes = 2;
  };

  for (const row of rows) {
    const encoded = canonicalJson(row);
    const rowBytes = encoder.encode(encoded).byteLength;
    if (rowBytes > CSV_JSON_ROW_MAX_BYTES) throw new Error("CSV_ROW_JSON_TOO_LARGE");
    const extraBytes = rowBytes + (parts.length === 0 ? 0 : 1);
    if (bytes + extraBytes > maxBytes) flush();
    if (2 + rowBytes > maxBytes) throw new Error("CSV_ROW_JSON_EXCEEDS_CHUNK_LIMIT");
    parts.push(encoded);
    bytes += rowBytes + (parts.length === 1 ? 0 : 1);
  }
  flush();
  return chunks;
}

function assertStatementCount(statements: readonly D1PreparedStatement[]): void {
  if (statements.length > CSV_D1_STATEMENT_MAX) {
    throw new Error("CSV_D1_STATEMENT_LIMIT_EXCEEDED");
  }
}

export function prepareJsonEachStatements(
  db: D1Database,
  sql: string,
  chunks: readonly string[],
): D1PreparedStatement[] {
  if (encoder.encode(sql).byteLength >= CSV_D1_SQL_MAX_BYTES) {
    throw new Error("CSV_D1_SQL_TOO_LARGE");
  }
  if (!/json_each\s*\(\s*\?\s*\)/i.test(sql) || (sql.match(/\?/g) ?? []).length !== 1) {
    throw new Error("CSV_D1_SQL_MUST_USE_ONE_JSON_PARAMETER");
  }
  assertStatementCount(chunks as unknown as D1PreparedStatement[]);
  const prepared = db.prepare(sql);
  return chunks.map((chunk) => {
    if (encoder.encode(chunk).byteLength > CSV_JSON_CHUNK_MAX_BYTES) {
      throw new Error("CSV_JSON_CHUNK_TOO_LARGE");
    }
    return prepared.bind(chunk);
  });
}

interface CsvAtomicBatchParts {
  commandGuard?: readonly D1PreparedStatement[];
  chunkWrites?: readonly D1PreparedStatement[];
  idempotencyResult?: readonly D1PreparedStatement[];
  domainWrites?: readonly D1PreparedStatement[];
  ledger?: readonly D1PreparedStatement[];
  audit?: readonly D1PreparedStatement[];
}

export function composeCsvAtomicBatch(parts: CsvAtomicBatchParts): D1PreparedStatement[] {
  const statements = [
    ...(parts.commandGuard ?? []),
    ...(parts.chunkWrites ?? []),
    ...(parts.idempotencyResult ?? []),
    ...(parts.domainWrites ?? []),
    ...(parts.ledger ?? []),
    ...(parts.audit ?? []),
  ];
  assertStatementCount(statements);
  return statements;
}

export async function runCsvAtomicBatch(
  db: D1Database,
  statements: readonly D1PreparedStatement[],
): Promise<D1Result[]> {
  assertStatementCount(statements);
  if (statements.length === 0) return [];
  return db.batch([...statements]);
}
