import type { AccountLinks, LinkedAccount, LinkedClient } from "../../../../shared/schemas/account-link-schema";
import type { VisibilityInput } from "../../../../shared/schemas/visibility-schema";

/**
 * 「アカウント連携」画面の公開設定の表（外部アカウント×公開先）の編集状態。
 * 保存済みの値に対する編集だけを持ち、再読込で行が増減しても編集中の値を保つ。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./visibility-draft.test.ts
 */

/**
 * 公開先。
 * `profile`は一般公開（公開プロフィール）、`client`はOAuthクライアント。
 */
export type Destination = { kind: "profile" } | { kind: "client"; client: LinkedClient };

/**
 * 保存済みの値に対する編集。
 * `clientVisibility`はClient ID→外部アカウントID→公開選択。
 */
export type VisibilityEdits = {
  accountPublic: Readonly<Record<string, boolean>>;
  clientVisibility: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
};

export const emptyVisibilityEdits: VisibilityEdits = { accountPublic: {}, clientVisibility: {} };

/**
 * 表の1列（公開先）。
 * `isPublished`は保存済みの状態で証明済みの行の選択が1件以上あること（「公開中」）。
 */
export type VisibilityColumn = {
  destination: Destination;
  isPublished: boolean;
};

/**
 * 表の1セル（外部アカウント×公開先）。
 * `isChanged`は保存済みの値から変わっていること。
 */
export type VisibilityCell = {
  isSelected: boolean;
  isChanged: boolean;
};

/**
 * 表の1行（外部アカウント）。
 * `cells`は`columns`と同じ順に並ぶ。
 */
export type VisibilityRow = {
  account: LinkedAccount;
  cells: VisibilityCell[];
};

export type VisibilityTable = {
  columns: VisibilityColumn[];
  rows: VisibilityRow[];
  changeCount: number;
};

// --------------------------------------------------
// 編集
// --------------------------------------------------

/**
 * 指定した公開先×外部アカウントの選択をまとめて変更する。
 * セル・行・列・全体の一括の選択に使う。
 */
export function setSelection(
  edits: VisibilityEdits,
  destinations: readonly Destination[],
  accountIds: readonly string[],
  isSelected: boolean,
): VisibilityEdits {
  const accountValues = Object.fromEntries(accountIds.map((accountId) => [accountId, isSelected]));
  let next = edits;
  for (const destination of destinations) {
    next =
      destination.kind === "profile"
        ? { ...next, accountPublic: { ...next.accountPublic, ...accountValues } }
        : {
            ...next,
            clientVisibility: {
              ...next.clientVisibility,
              [destination.client.clientId]: { ...next.clientVisibility[destination.client.clientId], ...accountValues },
            },
          };
  }
  return next;
}

// --------------------------------------------------
// 表
// --------------------------------------------------

/**
 * 公開先の並び（プロフィール、各クライアントの順）。
 */
function listDestinations(links: AccountLinks): Destination[] {
  return [{ kind: "profile" }, ...links.clients.map((client) => ({ kind: "client" as const, client }))];
}

function readSavedSelection(account: LinkedAccount, destination: Destination): boolean {
  return destination.kind === "profile" ? account.isPublic : (account.visibility[destination.client.clientId] ?? false);
}

function readEditedSelection(edits: VisibilityEdits, account: LinkedAccount, destination: Destination): boolean | undefined {
  return destination.kind === "profile"
    ? edits.accountPublic[account.id]
    : edits.clientVisibility[destination.client.clientId]?.[account.id];
}

/**
 * 一覧表の表示内容（列の公開状態・セルの選択と変更）と変更の件数を組み立てる。
 * 一覧に存在しない行・クライアントへの編集は対象外とする。
 */
export function buildVisibilityTable(links: AccountLinks, edits: VisibilityEdits): VisibilityTable {
  const destinations = listDestinations(links);
  const rows = links.accounts.map((account) => ({
    account,
    cells: destinations.map((destination) => {
      const saved = readSavedSelection(account, destination);
      const isSelected = readEditedSelection(edits, account, destination) ?? saved;
      return { isSelected, isChanged: isSelected !== saved };
    }),
  }));
  const verifiedAccounts = links.accounts.filter((account) => account.verificationStatus === "verified");
  const columns = destinations.map((destination) => ({
    destination,
    isPublished: verifiedAccounts.some((account) => readSavedSelection(account, destination)),
  }));
  const changeCount = rows.reduce((count, row) => count + row.cells.filter((cell) => cell.isChanged).length, 0);
  return { columns, rows, changeCount };
}

/**
 * `PUT /api/visibility`の入力を組み立てる。
 * 表示中の全行と全クライアントの編集後の値を送る。
 */
export function buildVisibilityInput(links: AccountLinks, edits: VisibilityEdits): VisibilityInput {
  const { columns, rows } = buildVisibilityTable(links, edits);
  const selectedAccountIds = (columnIndex: number) =>
    rows.filter((row) => row.cells[columnIndex]?.isSelected === true).map((row) => row.account.id);
  return {
    // 先頭の列はプロフィール（一般公開）。
    accounts: rows.map((row) => ({ externalAccountId: row.account.id, isPublic: row.cells[0]?.isSelected === true })),
    clients: columns.flatMap(({ destination }, columnIndex) =>
      destination.kind === "client"
        ? [{ clientId: destination.client.clientId, visibleAccountIds: selectedAccountIds(columnIndex) }]
        : [],
    ),
  };
}
