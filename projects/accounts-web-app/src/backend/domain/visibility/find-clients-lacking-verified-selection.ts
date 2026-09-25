/**
 * 公開設定の保存条件を判定する。
 * 同意ONのクライアントには、本人に証明済みとして紐付く外部アカウントを1件以上選択していなければならない。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./find-clients-lacking-verified-selection.test.ts
 */
export function findClientsLackingVerifiedSelection(
  clients: readonly { consented: boolean; visibleAccountIds: readonly string[] }[],
  verifiedAccountIds: ReadonlySet<string>,
): number[] {
  return clients.flatMap((client, index) =>
    client.consented &&
    !client.visibleAccountIds.some((accountId) => verifiedAccountIds.has(accountId))
      ? [index]
      : [],
  );
}
