import { Checkbox, Chip } from "@heroui/react";
import { useState } from "react";
import type { CSSProperties } from "react";

import type { LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { CheckIcon, ChevronDownIcon } from "../../app-shell/components/icons";
import { ServiceFavicon } from "../../app-shell/components/service-favicon";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import type { UnlinkTarget } from "../hooks/use-unlink";
import { describeAccount, formatAccountLabel } from "../lib/account-label";
import type { Destination, VisibilityRow, VisibilityTable as VisibilityTableModel } from "../lib/visibility-draft";
import { accountLinksMessages } from "../messages";
import type { AccountLinksMessages } from "../messages";
import { AccountDetail } from "./account-detail";

/**
 * 公開設定の表。
 * 外部アカウントを行、プロフィール（一般公開）と各連携先（OAuthクライアント）を列にし、セルのチェックで公開先を選ぶ。
 * 見出し行と先頭列を固定して枠の中で縦横にスクロールし、640px以下は先頭列を2段・公開先を短い幅にした圧縮表示にする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./account-links-views.test.tsx
 */
export function VisibilityTable({
  table,
  reverifyingAccountId,
  reverifyFailure,
  onSelect,
  onRequestUnlink,
  onReverify,
}: {
  table: VisibilityTableModel;
  reverifyingAccountId: string | null;
  reverifyFailure: { accountId: string; error: unknown } | null;
  onSelect: (destinations: Destination[], accountIds: string[], isSelected: boolean) => void;
  onRequestUnlink: (target: UnlinkTarget) => void;
  onReverify: (account: LinkedAccount) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const [expandedAccountIds, setExpandedAccountIds] = useState<ReadonlySet<string>>(new Set());
  const { columns, rows } = table;
  const destinations = columns.map((column) => column.destination);
  const accountIds = rows.map((row) => row.account.id);

  if (rows.length === 0) return <p className="text-sm text-muted">{messages.noAccounts}</p>;

  /**
   * 行の「詳細」を開閉する。
   */
  const toggleDetail = (accountId: string) =>
    setExpandedAccountIds((current) => {
      const next = new Set(current);
      if (!next.delete(accountId)) next.add(accountId);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-surface">
      <div ref={observeScrollWidth} className="max-h-(--table-max-h) overflow-auto">
        <table
          className="w-full min-w-[calc(var(--col-lead)+var(--col-dest)*var(--dest-count))] border-separate border-spacing-0 text-sm max-sm:[--col-dest:var(--col-dest-compact)] max-sm:[--col-lead:var(--col-lead-compact)] [&_tbody_tr:last-child>*]:border-b-0"
          style={{ "--dest-count": columns.length } as CSSProperties}
        >
          <caption className="sr-only">{messages.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${headCellClassName} ${leadCellClassName} z-3`}>
                <span className="sr-only">{messages.accountColumn}</span>
              </th>
              {columns.map((column) => {
                const name = formatDestinationName(column.destination, messages);
                return (
                  <th key={destinationKey(column.destination)} scope="col" className={`${headCellClassName} ${destinationCellClassName} z-2`}>
                    <div className="flex flex-col items-center gap-2">
                      <span
                        title={name}
                        className="text-sm font-medium text-foreground max-sm:max-w-(--col-dest-compact) max-sm:truncate max-sm:text-2xs"
                      >
                        {name}
                      </span>
                      <Chip color={column.isPublished ? "success" : "default"} variant="soft">
                        {column.isPublished ? messages.published : messages.unpublished}
                      </Chip>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={`${bulkCellClassName} ${leadCellClassName} z-1`}>
                <SelectionCheckbox
                  label={messages.bulkAllLabel}
                  values={rows.flatMap((row) => row.cells.map((cell) => cell.isSelected))}
                  onChange={(isSelected) => onSelect(destinations, accountIds, isSelected)}
                  className="max-sm:hidden"
                />
                <span className="hidden text-xs text-muted max-sm:inline">{messages.bulkShort}</span>
              </th>
              {columns.map((column, columnIndex) => (
                <td key={destinationKey(column.destination)} className={`${bulkCellClassName} ${destinationCellClassName}`}>
                  <SelectionCheckbox
                    label={messages.bulkColumnLabel(formatDestinationName(column.destination, messages))}
                    values={rows.map((row) => row.cells[columnIndex]?.isSelected === true)}
                    onChange={(isSelected) => onSelect([column.destination], accountIds, isSelected)}
                    className={destinationCheckboxClassName}
                  />
                </td>
              ))}
            </tr>
            {rows.map((row) => (
              <AccountRows
                key={row.account.id}
                row={row}
                destinations={destinations}
                isExpanded={expandedAccountIds.has(row.account.id)}
                isReverifying={reverifyingAccountId === row.account.id}
                reverifyError={reverifyFailure?.accountId === row.account.id ? reverifyFailure.error : null}
                onToggleDetail={() => toggleDetail(row.account.id)}
                onSelect={onSelect}
                onRequestUnlink={onRequestUnlink}
                onReverify={onReverify}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------
// セルの見た目
// --------------------------------------------------

// 背景色・余白・縦位置はセルの種類ごとに決め、同じ性質のユーティリティを重ねない。
const cellClassName = "border-b border-border";
const headCellClassName = `${cellClassName} sticky top-0 bg-surface pt-4 pb-3 align-top text-xs font-normal text-muted max-sm:py-3`;
const bodyCellClassName = `${cellClassName} py-4 align-middle max-sm:py-3`;
const bulkCellClassName = `${cellClassName} bg-surface-secondary py-2 align-middle`;
const leadCellClassName =
  "sticky left-0 w-(--col-lead) min-w-(--col-lead) px-4 text-left font-normal shadow-[inset_-1px_0_0_var(--border)] max-sm:pr-2 max-sm:pl-3";
const destinationCellClassName = "min-w-(--col-dest) px-2 text-center max-sm:px-0.5";
// チェックボックスの枠を中身の幅にし、公開先の列の中央に置く。
const destinationCheckboxClassName = "mx-auto w-fit";

// --------------------------------------------------
// 行
// --------------------------------------------------

/**
 * 外部アカウント1行と、開いているときはその下の全幅の詳細行。
 * 先頭列に行全体の一括チェック・サービスアイコン・「サービス名：識別子」・証明方法のチップ・「詳細」を置く。
 */
function AccountRows({
  row,
  destinations,
  isExpanded,
  isReverifying,
  reverifyError,
  onToggleDetail,
  onSelect,
  onRequestUnlink,
  onReverify,
}: {
  row: VisibilityRow;
  destinations: Destination[];
  isExpanded: boolean;
  isReverifying: boolean;
  reverifyError: unknown;
  onToggleDetail: () => void;
  onSelect: (destinations: Destination[], accountIds: string[], isSelected: boolean) => void;
  onRequestUnlink: (target: UnlinkTarget) => void;
  onReverify: (account: LinkedAccount) => void;
}) {
  const messages = useMessages(accountLinksMessages);
  const { account, cells } = row;
  const { serviceName, identifier, iconHost } = describeAccount(account);
  const label = formatAccountLabel(account, messages.accountLabelSeparator);
  const verifiedMethods = [...new Set(account.verifications.map((verification) => verification.method))];

  return (
    <>
      <tr>
        <th scope="row" className={`${bodyCellClassName} ${leadCellClassName} z-1 bg-surface`}>
          <div className="flex min-w-0 items-center gap-3 max-sm:gap-2">
            <SelectionCheckbox
              label={messages.rowLabel(label)}
              values={cells.map((cell) => cell.isSelected)}
              onChange={(isSelected) => onSelect(destinations, [account.id], isSelected)}
              className="max-sm:hidden"
            />
            {iconHost === undefined ? null : (
              <span className="shrink-0 max-sm:[&>span]:size-7">
                <ServiceFavicon host={iconHost} />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1 leading-tight">
              <span className="text-md font-medium wrap-anywhere">
                <span className="max-sm:block">{serviceName}</span>
                <span className="max-sm:hidden">{messages.accountLabelSeparator}</span>
                <span className="max-sm:block max-sm:font-mono max-sm:text-xs max-sm:font-normal max-sm:text-muted">
                  {identifier}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1">
                {account.verificationStatus === "verified" ? (
                  verifiedMethods.map((method) => (
                    <Chip key={method} color="success" variant="soft" className="max-sm:hidden">
                      <CheckIcon className="size-3" />
                      {messages.methods[method]}
                    </Chip>
                  ))
                ) : (
                  <Chip color="default" variant="soft">
                    {messages.statusUnverified}
                  </Chip>
                )}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={onToggleDetail}
                  className="inline-flex cursor-pointer items-center gap-0.5 rounded-full px-2 py-0.5 text-xs text-muted hover:bg-surface-secondary hover:text-foreground"
                >
                  {messages.details}
                  <ChevronDownIcon className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
              </span>
            </div>
          </div>
        </th>
        {cells.map((cell, columnIndex) => {
          const destination = destinations[columnIndex] as Destination;
          return (
            <td
              key={destinationKey(destination)}
              className={`${bodyCellClassName} ${destinationCellClassName} ${cell.isChanged ? "bg-highlight" : "bg-surface"}`}
            >
              <SelectionCheckbox
                label={messages.cellLabel(label, formatDestinationName(destination, messages))}
                values={[cell.isSelected]}
                onChange={(isSelected) => onSelect([destination], [account.id], isSelected)}
                className={destinationCheckboxClassName}
              />
            </td>
          );
        })}
      </tr>
      {isExpanded ? (
        <tr>
          <td colSpan={cells.length + 1} className="border-b border-border bg-surface-secondary p-0 text-left">
            {/* 詳細はスクロール領域の幅に合わせ、横スクロールしても左端に留める。 */}
            <div className="sticky left-0 flex w-(--scroll-w) flex-col gap-3 p-4">
              <AccountDetail
                account={account}
                serviceName={serviceName}
                isReverifying={isReverifying}
                reverifyError={reverifyError}
                onRequestUnlink={onRequestUnlink}
                onReverify={onReverify}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// --------------------------------------------------
// 部品
// --------------------------------------------------

/**
 * 1つ以上のセルの選択をまとめて示すチェックボックス。
 * すべて選択でON、一部選択で中間表示にし、対象が無ければ無効にする。
 */
function SelectionCheckbox({
  label,
  values,
  onChange,
  className,
}: {
  label: string;
  values: boolean[];
  onChange: (isSelected: boolean) => void;
  className?: string;
}) {
  const selectedCount = values.filter(Boolean).length;
  return (
    <Checkbox
      aria-label={label}
      isSelected={values.length > 0 && selectedCount === values.length}
      isIndeterminate={selectedCount > 0 && selectedCount < values.length}
      isDisabled={values.length === 0}
      onChange={onChange}
      className={className}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

/**
 * 公開先の表示名。
 */
function formatDestinationName(destination: Destination, messages: AccountLinksMessages): string {
  return destination.kind === "profile" ? messages.profileColumn : destination.client.name;
}

/**
 * 公開先のReactのkey。
 */
function destinationKey(destination: Destination): string {
  return destination.kind === "profile" ? "profile" : `client:${destination.client.clientId}`;
}

/**
 * スクロール領域の表示幅を`--scroll-w`に入れる（callback ref）。
 * 詳細行の中身を、横スクロールしても表示幅いっぱいに左端へ留めるために使う。
 */
function observeScrollWidth(element: HTMLDivElement | null) {
  if (element === null) return;
  const observer = new ResizeObserver(() => element.style.setProperty("--scroll-w", `${element.clientWidth}px`));
  observer.observe(element);
  return () => observer.disconnect();
}
