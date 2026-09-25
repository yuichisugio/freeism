import type { AccountLinks, LinkedAccount, LinkedClient } from "../../../../shared/schemas/account-link-schema";
import type { VisibilityInput } from "../../../../shared/schemas/visibility-schema";

/**
 * 「アカウント連携」画面の一覧表（外部アカウント×公開先）の編集状態。
 * 保存済みの値に対する編集だけを持ち、再読込で行が増減しても編集中の値を保つ。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./visibility-draft.test.ts
 */

/**
 * 保存済みの値に対する編集。
 * `clientVisibility`はClient ID→外部アカウントID→公開選択。
 */
export type VisibilityEdits = {
  accountPublic: Readonly<Record<string, boolean>>;
  clientConsent: Readonly<Record<string, boolean>>;
  clientVisibility: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
};

export const emptyVisibilityEdits: VisibilityEdits = { accountPublic: {}, clientConsent: {}, clientVisibility: {} };

/**
 * 表の1行（外部アカウント）。
 */
export type VisibilityRow = {
  account: LinkedAccount;
  isPublic: boolean;
  visibleClientIds: string[];
};

/**
 * 表の1列（OAuthクライアント）。
 * `lacksVerifiedSelection`は同意ONで証明済みの外部アカウントが1件も選択されていないこと。
 */
export type VisibilityColumn = {
  client: LinkedClient;
  consented: boolean;
  lacksVerifiedSelection: boolean;
};

export type VisibilityTable = {
  rows: VisibilityRow[];
  columns: VisibilityColumn[];
  isDirty: boolean;
  canSave: boolean;
};

// --------------------------------------------------
// 編集
// --------------------------------------------------

/**
 * 外部アカウントの一般公開を変更する。
 */
export function setAccountPublic(edits: VisibilityEdits, accountId: string, isPublic: boolean): VisibilityEdits {
  return { ...edits, accountPublic: { ...edits.accountPublic, [accountId]: isPublic } };
}

/**
 * クライアントへの情報提供同意を変更する。
 */
export function setClientConsent(edits: VisibilityEdits, clientId: string, consented: boolean): VisibilityEdits {
  return { ...edits, clientConsent: { ...edits.clientConsent, [clientId]: consented } };
}

/**
 * クライアントへの外部アカウントの公開選択を、指定した行についてまとめて変更する。
 */
export function setClientVisibility(
  edits: VisibilityEdits,
  clientId: string,
  accountIds: readonly string[],
  isVisible: boolean,
): VisibilityEdits {
  const next = { ...edits.clientVisibility[clientId] };
  for (const accountId of accountIds) next[accountId] = isVisible;
  return { ...edits, clientVisibility: { ...edits.clientVisibility, [clientId]: next } };
}

// --------------------------------------------------
// 編集後の値
// --------------------------------------------------

function resolveAccountPublic(account: LinkedAccount, edits: VisibilityEdits): boolean {
  return edits.accountPublic[account.id] ?? account.isPublic;
}

function resolveConsent(client: LinkedClient, edits: VisibilityEdits, forcedConsentClientId?: string): boolean {
  if (client.clientId === forcedConsentClientId) return true;
  return edits.clientConsent[client.clientId] ?? client.consented;
}

function resolveVisibility(client: LinkedClient, account: LinkedAccount, edits: VisibilityEdits): boolean {
  return edits.clientVisibility[client.clientId]?.[account.id] ?? account.visibility[client.clientId] ?? false;
}

/**
 * 保存済みの値から変更があるか判定する。
 * 一覧に存在しない行・クライアントへの編集は対象外とする。
 */
export function isVisibilityDirty(links: AccountLinks, edits: VisibilityEdits): boolean {
  return (
    links.accounts.some((account) => resolveAccountPublic(account, edits) !== account.isPublic) ||
    links.clients.some(
      (client) =>
        resolveConsent(client, edits) !== client.consented ||
        links.accounts.some(
          (account) => resolveVisibility(client, account, edits) !== (account.visibility[client.clientId] ?? false),
        ),
    )
  );
}

/**
 * 一覧表の表示内容と保存可否を組み立てる。
 * `forcedConsentClientId`は同意画面の「同意して戻る」で同意ONとして保存する連携先。
 */
export function buildVisibilityTable(
  links: AccountLinks,
  edits: VisibilityEdits,
  forcedConsentClientId?: string,
): VisibilityTable {
  const rows = links.accounts.map((account) => ({
    account,
    isPublic: resolveAccountPublic(account, edits),
    visibleClientIds: links.clients
      .filter((client) => resolveVisibility(client, account, edits))
      .map((client) => client.clientId),
  }));
  const columns = links.clients.map((client) => {
    const consented = resolveConsent(client, edits, forcedConsentClientId);
    const hasVerifiedSelection = rows.some(
      (row) => row.account.verificationStatus === "verified" && row.visibleClientIds.includes(client.clientId),
    );
    return { client, consented, lacksVerifiedSelection: consented && !hasVerifiedSelection };
  });
  const isDirty = isVisibilityDirty(links, edits);
  const isValid = columns.every((column) => !column.lacksVerifiedSelection);
  return { rows, columns, isDirty, canSave: isDirty && isValid };
}

/**
 * `PUT /api/visibility`の入力を組み立てる。
 * 表示中の全行と全クライアントの編集後の値を送る。
 */
export function buildVisibilityInput(
  links: AccountLinks,
  edits: VisibilityEdits,
  forcedConsentClientId?: string,
): VisibilityInput {
  const table = buildVisibilityTable(links, edits, forcedConsentClientId);
  return {
    accounts: table.rows.map((row) => ({ externalAccountId: row.account.id, isPublic: row.isPublic })),
    clients: table.columns.map((column) => ({
      clientId: column.client.clientId,
      consented: column.consented,
      visibleAccountIds: table.rows
        .filter((row) => row.visibleClientIds.includes(column.client.clientId))
        .map((row) => row.account.id),
    })),
  };
}
