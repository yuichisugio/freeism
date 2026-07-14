export const MAX_D1_JSON_CHUNK_BYTES = 1_500_000;
export const MAX_D1_BATCH_STATEMENTS = 40;
export const MAX_D1_SQL_BYTES = 100_000;

const encoder = new TextEncoder();

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("INVALID_CANONICAL_JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("INVALID_CANONICAL_JSON");
    }
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("INVALID_CANONICAL_JSON");
}

export function createCanonicalJsonChunks(rows: readonly unknown[]): readonly string[] {
  const chunks: string[] = [];
  let currentRows: string[] = [];
  let currentByteLength = 2;

  for (const row of rows) {
    const serialized = canonicalJson(row);
    const rowByteLength = encoder.encode(serialized).byteLength;
    if (rowByteLength + 2 > MAX_D1_JSON_CHUNK_BYTES) {
      throw new Error("D1_JSON_ROW_TOO_LARGE");
    }

    const separatorBytes = currentRows.length === 0 ? 0 : 1;
    if (currentByteLength + separatorBytes + rowByteLength > MAX_D1_JSON_CHUNK_BYTES) {
      chunks.push(`[${currentRows.join(",")}]`);
      currentRows = [];
      currentByteLength = 2;
    }
    if (currentRows.length > 0) currentByteLength += 1;
    currentRows.push(serialized);
    currentByteLength += rowByteLength;
  }

  if (currentRows.length > 0) chunks.push(`[${currentRows.join(",")}]`);
  return chunks;
}

export function assertD1JsonBatchPlan(input: {
  chunkCount: number;
  fixedStatementCount: number;
  sqlTemplates: readonly string[];
}) {
  if (
    !Number.isSafeInteger(input.chunkCount) ||
    input.chunkCount < 0 ||
    !Number.isSafeInteger(input.fixedStatementCount) ||
    input.fixedStatementCount < 0
  ) {
    throw new Error("INVALID_D1_BATCH_PLAN");
  }

  for (const sql of input.sqlTemplates) {
    if (encoder.encode(sql).byteLength >= MAX_D1_SQL_BYTES) throw new Error("D1_SQL_TOO_LARGE");
    if ((sql.match(/\?/g) ?? []).length !== 1) {
      throw new Error("D1_JSON_STATEMENT_PARAMETER_INVALID");
    }
  }

  const statementCount = input.fixedStatementCount + input.chunkCount * input.sqlTemplates.length;
  if (statementCount > MAX_D1_BATCH_STATEMENTS) {
    throw new Error("D1_STATEMENT_LIMIT_EXCEEDED");
  }
  return { boundParametersPerStatement: 1, statementCount } as const;
}
