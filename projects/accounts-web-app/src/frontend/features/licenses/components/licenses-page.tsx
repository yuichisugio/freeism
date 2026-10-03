import { Button } from "@heroui/react";
import { useState } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ExternalLinkIcon } from "../../app-shell/components/icons";
import { PageMain } from "../../app-shell/components/page-main";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import { useLicenses } from "../hooks/use-licenses";
import type { LicensesState } from "../hooks/use-licenses";
import type { DependencyLicense } from "../license-schema";
import { licensesMessages } from "../messages";

/**
 * OSSライセンス画面（`/licenses`）。
 * @see ./licenses-page.test.tsx
 */
export function LicensesPage() {
  const state = useLicenses();
  return <LicensesView state={state} />;
}

/**
 * ライセンス一覧の表示。
 * 読み込み中・ビルド前・失敗・0件をテキストで区別する。
 * 一覧は、見出し行と先頭列を固定して縦横にスクロールする表にする。
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export function LicensesView({ state }: { state: LicensesState }) {
  const messages = useMessages(licensesMessages);
  return (
    <PageMain>
      <h1 className="pt-2 text-2xl">{messages.title}</h1>
      <p className="text-sm text-muted">{messages.description}</p>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "notBuilt" ? <p role="status">{messages.notBuilt}</p> : null}
      {state.status === "failed" ? <ErrorText>{messages.loadFailed}</ErrorText> : null}
      {state.status === "loaded" && state.licenses.length === 0 ? <p>{messages.empty}</p> : null}
      {state.status === "loaded" && state.licenses.length > 0 ? <LicensesTable licenses={state.licenses} /> : null}
    </PageMain>
  );
}

// --------------------------------------------------
// 表
// --------------------------------------------------

const headerCellClassName =
  "sticky top-0 z-2 border-b border-border bg-surface px-4 py-3 text-left text-xs font-normal whitespace-nowrap text-muted max-sm:px-3 max-sm:py-2";
const bodyCellClassName =
  "border-b border-border bg-surface px-4 py-3 align-middle whitespace-nowrap max-sm:px-3 max-sm:py-2";
const leadColumnClassName = "sticky left-0 shadow-[inset_-1px_0_0_var(--border)]";

/**
 * パッケージ・バージョン・ライセンス・リンクの表。
 * 全文は長いため、行の下に開閉する全幅の行で表示する。
 */
function LicensesTable({ licenses }: { licenses: DependencyLicense[] }) {
  const messages = useMessages(licensesMessages);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-surface">
      {/* 読み上げ用の文言（`sr-only`の絶対配置）の基準をスクロール領域にし、スクロールで隠れた行の分だけ画面がフッターより下へ伸びないようにする。 */}
      <div className="@container relative max-h-(--table-max-h) overflow-auto">
        <table className="w-full min-w-140 border-separate border-spacing-0 text-sm [&_tbody_tr:last-child>*]:border-b-0">
          <caption className="sr-only">{messages.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col" className={`${headerCellClassName} ${leadColumnClassName} z-3`}>
                {messages.packageColumn}
              </th>
              <th scope="col" className={headerCellClassName}>
                {messages.versionColumn}
              </th>
              <th scope="col" className={headerCellClassName}>
                {messages.licenseColumn}
              </th>
              <th scope="col" className={headerCellClassName}>
                {messages.linkColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {licenses.map((license) => (
              <LicenseRows key={`${license.name}@${license.version}`} license={license} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 1パッケージの行と、開いたときの全文の行。
 * リンクは`build.license`の出力にパッケージのURLが無いため、npmのパッケージのページにする。
 */
function LicenseRows({ license }: { license: DependencyLicense }) {
  const messages = useMessages(licensesMessages);
  const [isTextOpen, setIsTextOpen] = useState(false);
  const textRowId = `license-text-${license.name}@${license.version}`;
  const packageUrl = `https://www.npmjs.com/package/${license.name}`;
  return (
    <>
      <tr>
        <th
          scope="row"
          className={`${bodyCellClassName} ${leadColumnClassName} z-1 text-left font-mono font-normal max-sm:max-w-(--col-lead-compact) max-sm:whitespace-normal max-sm:[overflow-wrap:anywhere]`}
        >
          {license.name}
        </th>
        <td className={`${bodyCellClassName} tabular-nums`}>{license.version}</td>
        <td className={bodyCellClassName}>
          <span className="inline-flex items-center gap-2">
            {license.identifier ?? messages.unknownIdentifier}
            {license.text === undefined ? null : (
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={isTextOpen}
                aria-controls={isTextOpen ? textRowId : undefined}
                onPress={() => setIsTextOpen((isOpen) => !isOpen)}
              >
                {messages.showText}
              </Button>
            )}
          </span>
        </td>
        <td className={bodyCellClassName}>
          <a href={packageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            {packageUrl.replace("https://www.", "")}
            <ExternalLinkIcon className="size-3.5" />
            <span className="sr-only">{messages.opensInNewTab}</span>
          </a>
        </td>
      </tr>
      {isTextOpen && license.text !== undefined ? (
        <tr id={textRowId}>
          <td colSpan={4} className="border-b border-border bg-surface-secondary p-0">
            {/* 表を横にスクロールしても全文が見えるよう、スクロール領域の幅で左端に固定する。 */}
            <pre className="sticky left-0 w-[100cqw] p-4 font-mono text-xs whitespace-pre-wrap">{license.text}</pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
