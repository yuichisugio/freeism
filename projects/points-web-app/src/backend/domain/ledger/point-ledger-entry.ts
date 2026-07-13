export const MAX_SAFE_LEDGER_AMOUNT = 9_007_199_254_740_991;

export function assertSafeLedgerAmount(value: number): number {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_SAFE_LEDGER_AMOUNT) {
    throw new Error("SAFE_INTEGER_OVERFLOW");
  }
  return value;
}
