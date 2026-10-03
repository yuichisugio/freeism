/** 接続先IDに対応するBetter AuthのProvider ID。 */
export function toAccountsProviderId(connectionId: string): string {
  return `accounts-${connectionId}`;
}
