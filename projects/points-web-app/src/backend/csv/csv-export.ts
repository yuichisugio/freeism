import { scaledAmountCodec } from "../domain/money/scaled-amount";

interface TextCell {
  kind: "text";
  value: string;
}

interface AmountCell {
  kind: "amount";
  value: string;
  minimumUnit: string;
}

type CsvExportCell = TextCell | AmountCell;

export function textCell(value: string): TextCell {
  return { kind: "text", value };
}

export function amountCell(value: string, minimumUnit: string): AmountCell {
  return { kind: "amount", minimumUnit, value };
}

function encodeField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function encodeText(value: string): string {
  const normalized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  return /^[=+\-@\t\n]/.test(normalized) ? `'${normalized}` : normalized;
}

function encodeAmount(cell: AmountCell): string {
  try {
    const amount = scaledAmountCodec.parse(cell.value);
    const minimumUnit = scaledAmountCodec.parse(cell.minimumUnit);
    if (minimumUnit <= 0) throw new Error("invalid minimum unit");
    scaledAmountCodec.assertMultiple(amount, minimumUnit);
  } catch {
    throw new Error("INVALID_CSV_EXPORT_AMOUNT");
  }
  return cell.value;
}

export function encodeCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvExportCell[])[],
): string {
  const records = [headers.map(encodeField).join(",")];
  for (const row of rows) {
    if (row.length !== headers.length) throw new Error("CSV_EXPORT_COLUMN_COUNT_MISMATCH");
    records.push(
      row
        .map((cell) =>
          encodeField(cell.kind === "amount" ? encodeAmount(cell) : encodeText(cell.value)),
        )
        .join(","),
    );
  }
  return `${records.join("\r\n")}\r\n`;
}
