import { scaledAmountCodec } from "../domain/money/scaled-amount";

export interface CsvColumn {
  name: string;
  maxCodePoints: number;
  validate(value: string): string[];
}

export interface CsvSchema<Row extends Record<string, string> = Record<string, string>> {
  importType: string;
  columns: readonly CsvColumn[];
  maxRows: number;
  businessKey?: (row: Row) => string;
}

interface SchemaInput<Row extends Record<string, string>> {
  importType: string;
  columns: readonly CsvColumn[];
  maxRows?: number;
  businessKey?: (row: Row) => string;
}

export function defineCsvSchema<Row extends Record<string, string> = Record<string, string>>(
  input: SchemaInput<Row>,
): CsvSchema<Row> {
  if (
    input.columns.length === 0 ||
    new Set(input.columns.map((column) => column.name)).size !== input.columns.length
  ) {
    throw new Error("CSV_SCHEMA_COLUMNS_INVALID");
  }
  const maxRows = input.maxRows ?? 1_000;
  if (!Number.isSafeInteger(maxRows) || maxRows < 0 || maxRows > 1_000) {
    throw new Error("CSV_SCHEMA_ROW_LIMIT_INVALID");
  }
  return { ...input, maxRows };
}

export function textColumn(name: string, options: { maxCodePoints: number }): CsvColumn {
  return {
    name,
    maxCodePoints: options.maxCodePoints,
    validate: () => [],
  };
}

const DECIMAL_WITH_TOO_MANY_PLACES = /^-?(0|[1-9][0-9]*)\.[0-9]{5,}$/;

export function validatedAmountColumn(name: string, options: { minimumUnit: string }): CsvColumn {
  const minimumUnitScaled = scaledAmountCodec.parse(options.minimumUnit);
  if (minimumUnitScaled <= 0) {
    throw new Error("CSV_SCHEMA_MINIMUM_UNIT_INVALID");
  }

  return {
    name,
    maxCodePoints: 128,
    validate(value) {
      let amountScaled: number;
      try {
        amountScaled = scaledAmountCodec.parse(value);
      } catch (error) {
        if (DECIMAL_WITH_TOO_MANY_PLACES.test(value)) {
          return ["AMOUNT_SCALE_EXCEEDED"];
        }
        return [
          error instanceof RangeError ? "AMOUNT_SAFE_INTEGER_EXCEEDED" : "AMOUNT_INVALID_FORMAT",
        ];
      }

      try {
        scaledAmountCodec.assertMultiple(amountScaled, minimumUnitScaled);
      } catch {
        return ["AMOUNT_MINIMUM_UNIT_MISMATCH"];
      }
      return [];
    },
  };
}
