export interface CsvError {
  code: string;
  field: string | null;
  row: number;
}

export function csvError(code: string, row: number, field: string | null = null): CsvError {
  return { code, field, row };
}
