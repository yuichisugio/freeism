/** CSV の次に読む行番号を cursor として渡す。 */
export function createCsvExportCursor(nextOrdinal: number): string {
  if (!Number.isSafeInteger(nextOrdinal) || nextOrdinal < 0) {
    throw new Error("CSV_EXPORT_CURSOR_INVALID");
  }
  return String(nextOrdinal);
}

/** 数値 ordinal の形式を検証する。 */
export function parseCsvExportCursor(cursor: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(cursor)) {
    throw new Error("CSV_EXPORT_CURSOR_INVALID");
  }
  const nextOrdinal = Number(cursor);
  if (!Number.isSafeInteger(nextOrdinal)) {
    throw new Error("CSV_EXPORT_CURSOR_INVALID");
  }
  return nextOrdinal;
}
