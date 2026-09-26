import { Button, Checkbox, Chip, Link, Switch } from "@heroui/react";
import { useState } from "react";

import type { LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { formatDateTime } from "../../../lib/i18n/format";
import { useI18n, useMessages } from "../../../lib/i18n/i18n-provider";
import type { VisibilitySaveState } from "../hooks/use-account-links";
import { formatAccountLabel } from "../lib/account-label";
import type { VisibilityColumn, VisibilityRow, VisibilityTable as VisibilityTableModel } from "../lib/visibility-draft";
import { accountLinksMessages } from "../messages";
import { VerificationList } from "./verification-details";

/**
 * 外部アカウントを行、一般公開と各連携先（OAuthクライアント）を列にした公開設定の表。
 * 一般公開・情報提供同意・公開選択の変更は、表の上下に置く同じ保存ボタンでまとめて反映する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 */
export function VisibilityTable({
  table,
  saveState,
  onAccountPublicChange,
  onClientConsentChange,
  onClientVisibilityChange,
  onAccountVisibilityForAllClientsChange,
  onSave,
  onDiscard,
  onRequestUnlinkAccount,
  onRequestUnlinkOAuth,
}: {
  table: VisibilityTableModel;
  saveState: VisibilitySaveState;
  onAccountPublicChange: (accountId: string, isPublic: boolean) => void;
  onClientConsentChange: (clientId: string, consented: boolean) => void;
  onClientVisibilityChange: (clientId: string, accountIds: string[], isVisible: boolean) => void;
  onAccountVisibilityForAllClientsChange: (accountId: string, isVisible: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
  onRequestUnlinkAccount: (account: LinkedAccount) => void;
  onRequestUnlinkOAuth: (account: LinkedAccount, authAccountId: string) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const [lastSavedFrom, setLastSavedFrom] = useState<SaveBarPosition>("top");
  const hasClients = table.columns.length > 0;
  const blockedColumns = table.columns.filter((column) => column.lacksVerifiedSelection);
  const verifiedAccountIds = table.rows
    .filter((row) => row.account.verificationStatus === "verified")
    .map((row) => row.account.id);

  if (table.rows.length === 0) return <p>{messages.noAccounts}</p>;

  /**
   * 表の上または下の保存・破棄の操作。
   * 保存の結果は、押した保存ボタンの側にだけ示す。
   */
  const renderSaveBar = (position: SaveBarPosition) => (
    <VisibilitySaveBar
      table={table}
      saveState={lastSavedFrom === position ? saveState : { status: "idle" }}
      isSaving={saveState.status === "saving"}
      hasBlockedColumns={blockedColumns.length > 0}
      onSave={() => {
        setLastSavedFrom(position);
        onSave();
      }}
      onDiscard={onDiscard}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {renderSaveBar("top")}
      {hasClients ? null : <p className="text-sm text-muted">{messages.noClients}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{messages.tableCaption}</caption>
          <thead>
            <tr className="border-b border-default align-top">
              <th scope="col" className="p-2 text-left">
                {messages.accountColumn}
              </th>
              <th scope="col" className="p-2 text-left">
                {messages.publicColumn}
              </th>
              {hasClients ? (
                <th scope="col" className="p-2 text-left">
                  {messages.bulkRow}
                </th>
              ) : null}
              {table.columns.map((column) => (
                <ClientColumnHeader
                  key={column.client.clientId}
                  column={column}
                  table={table}
                  verifiedAccountIds={verifiedAccountIds}
                  onConsentChange={(consented) => onClientConsentChange(column.client.clientId, consented)}
                  onBulkChange={(isVisible) => onClientVisibilityChange(column.client.clientId, verifiedAccountIds, isVisible)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <AccountRow
                key={row.account.id}
                row={row}
                columns={table.columns}
                onPublicChange={(isPublic) => onAccountPublicChange(row.account.id, isPublic)}
                onClientVisibilityChange={(clientId, isVisible) =>
                  onClientVisibilityChange(clientId, [row.account.id], isVisible)
                }
                onAllClientsChange={(isVisible) => onAccountVisibilityForAllClientsChange(row.account.id, isVisible)}
                onRequestUnlinkAccount={() => onRequestUnlinkAccount(row.account)}
                onRequestUnlinkOAuth={(authAccountId) => onRequestUnlinkOAuth(row.account, authAccountId)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div aria-live="polite" className="flex flex-col gap-1">
        {blockedColumns.map((column) => (
          <p key={column.client.clientId} className="text-sm text-danger">
            {messages.lacksVerifiedSelection(column.client.name)}
          </p>
        ))}
      </div>
      {renderSaveBar("bottom")}
    </div>
  );
}

// --------------------------------------------------
// 保存・破棄
// --------------------------------------------------

type SaveBarPosition = "top" | "bottom";

/**
 * 表の上下に置く「公開設定を保存」「編集内容を破棄」と、未保存の変更・保存できない理由の短い表示。
 * `saveState`は、このボタンで保存した場合の結果の表示に使う。
 */
function VisibilitySaveBar({
  table,
  saveState,
  isSaving,
  hasBlockedColumns,
  onSave,
  onDiscard,
}: {
  table: VisibilityTableModel;
  saveState: VisibilitySaveState;
  isSaving: boolean;
  hasBlockedColumns: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const common = useMessages(commonMessages);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" isDisabled={!table.canSave || isSaving} onPress={onSave}>
          {isSaving ? common.saving : messages.saveVisibility}
        </Button>
        <Button variant="secondary" isDisabled={!table.isDirty || isSaving} onPress={onDiscard}>
          {messages.discardVisibility}
        </Button>
        {table.isDirty ? <span className="text-sm font-semibold">{messages.unsavedChanges}</span> : null}
        {hasBlockedColumns ? <span className="text-sm">{messages.saveBlocked}</span> : null}
      </div>
      {saveState.status === "saved" ? <SuccessNotice>{messages.visibilitySaved}</SuccessNotice> : null}
      {saveState.status === "error" ? <ErrorNotice error={saveState.error} codeMessages={messages.errorCodes} /> : null}
    </div>
  );
}

// --------------------------------------------------
// 列の見出し
// --------------------------------------------------

/**
 * 連携先の列の見出し。
 * 情報提供同意のON・OFFと、証明済みの外部アカウントの一括選択を置き、保存できない理由を列に示す。
 */
function ClientColumnHeader({
  column,
  table,
  verifiedAccountIds,
  onConsentChange,
  onBulkChange,
}: {
  column: VisibilityColumn;
  table: VisibilityTableModel;
  verifiedAccountIds: string[];
  onConsentChange: (consented: boolean) => void;
  onBulkChange: (isVisible: boolean) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const { client } = column;
  const selectedCount = table.rows.filter(
    (row) => verifiedAccountIds.includes(row.account.id) && row.visibleClientIds.includes(client.clientId),
  ).length;
  return (
    <th
      scope="col"
      className={`p-2 text-left ${column.lacksVerifiedSelection ? "outline outline-2 outline-danger" : ""}`}
    >
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{client.name}</span>
        {client.uri === null ? null : (
          <Link href={client.uri} target="_blank" rel="noreferrer" className="text-xs">
            {messages.clientLink}
          </Link>
        )}
        <Switch size="sm" isSelected={column.consented} onChange={onConsentChange}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="text-xs font-normal">{messages.consentLabel(client.name)}</span>
          </Switch.Content>
        </Switch>
        <Checkbox
          aria-label={messages.bulkColumnLabel(client.name)}
          isDisabled={verifiedAccountIds.length === 0}
          isSelected={verifiedAccountIds.length > 0 && selectedCount === verifiedAccountIds.length}
          isIndeterminate={selectedCount > 0 && selectedCount < verifiedAccountIds.length}
          onChange={onBulkChange}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="text-xs font-normal">{messages.bulkColumnHint}</span>
          </Checkbox.Content>
        </Checkbox>
        {column.lacksVerifiedSelection ? (
          <Chip size="sm" color="danger">
            {messages.lacksVerifiedSelection(client.name)}
          </Chip>
        ) : null}
      </div>
    </th>
  );
}

// --------------------------------------------------
// 行
// --------------------------------------------------

/**
 * 表のセルに置く、ラベルを持たないチェックボックス。
 */
function CellCheckbox({
  label,
  isSelected,
  isIndeterminate,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  isIndeterminate?: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    <Checkbox aria-label={label} isSelected={isSelected} isIndeterminate={isIndeterminate} onChange={onChange}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

/**
 * 外部アカウント1行。
 * 外部アカウントの情報・証明方法ごとの結果・解除操作と、公開先ごとのチェックボックスを置く。
 */
function AccountRow({
  row,
  columns,
  onPublicChange,
  onClientVisibilityChange,
  onAllClientsChange,
  onRequestUnlinkAccount,
  onRequestUnlinkOAuth,
}: {
  row: VisibilityRow;
  columns: VisibilityColumn[];
  onPublicChange: (isPublic: boolean) => void;
  onClientVisibilityChange: (clientId: string, isVisible: boolean) => void;
  onAllClientsChange: (isVisible: boolean) => void;
  onRequestUnlinkAccount: () => void;
  onRequestUnlinkOAuth: (authAccountId: string) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const { language } = useI18n();
  const { account } = row;
  const label = formatAccountLabel(account);
  const oauthAccountIds = account.verifications.flatMap((verification) =>
    verification.method === "oauth" && verification.authAccountId !== null ? [verification.authAccountId] : [],
  );
  const visibleCount = row.visibleClientIds.length;

  return (
    <tr className="border-b border-default align-top">
      <th scope="row" className="p-2 text-left font-normal">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{label}</span>
            <Chip size="sm" color={account.verificationStatus === "verified" ? "success" : "default"}>
              {account.verificationStatus === "verified" ? messages.statusVerified : messages.statusUnverified}
            </Chip>
          </div>
          {account.email === null ? null : (
            <p className="text-xs text-muted">
              {messages.email}: {account.email}
            </p>
          )}
          {account.linkedAt === null ? null : (
            <p className="text-xs text-muted">
              {messages.linkedAt}: {formatDateTime(account.linkedAt, language)}
            </p>
          )}
          {account.hasImportedVerifications ? <p className="text-xs">{messages.importedCandidate}</p> : null}
          <div>
            <p className="text-xs font-semibold">{messages.identifiers}</p>
            <ul className="text-xs">
              {account.identifiers.map((identifier) => (
                <li key={identifier.id} className="break-all">
                  {messages.identifierTypes[identifier.type]}: {identifier.value}
                  {identifier.isActive ? null : ` (${messages.candidateIdentifier})`}
                </li>
              ))}
            </ul>
          </div>
          <VerificationList verifications={account.verifications} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="danger-soft" onPress={onRequestUnlinkAccount}>
              {messages.unlinkAccount}
            </Button>
            {oauthAccountIds.map((authAccountId) => (
              <Button key={authAccountId} size="sm" variant="outline" onPress={() => onRequestUnlinkOAuth(authAccountId)}>
                {messages.unlinkOAuthOnly}
              </Button>
            ))}
          </div>
        </div>
      </th>
      <td className="p-2">
        <CellCheckbox label={messages.publicCellLabel(label)} isSelected={row.isPublic} onChange={onPublicChange} />
      </td>
      {columns.length > 0 ? (
        <td className="p-2">
          <CellCheckbox
            label={messages.bulkRowLabel(label)}
            isSelected={visibleCount === columns.length}
            isIndeterminate={visibleCount > 0 && visibleCount < columns.length}
            onChange={onAllClientsChange}
          />
        </td>
      ) : null}
      {columns.map((column) => (
        <td key={column.client.clientId} className="p-2">
          <CellCheckbox
            label={messages.clientCellLabel(label, column.client.name)}
            isSelected={row.visibleClientIds.includes(column.client.clientId)}
            onChange={(isVisible) => onClientVisibilityChange(column.client.clientId, isVisible)}
          />
        </td>
      ))}
    </tr>
  );
}
