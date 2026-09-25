import { useMessages } from "../../../lib/i18n/i18n-provider";
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
 */
export function LicensesView({ state }: { state: LicensesState }) {
  const messages = useMessages(licensesMessages);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p>{messages.description}</p>
      </header>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "notBuilt" ? <p role="status">{messages.notBuilt}</p> : null}
      {state.status === "failed" ? <ErrorText>{messages.loadFailed}</ErrorText> : null}
      {state.status === "loaded" && state.licenses.length === 0 ? <p>{messages.empty}</p> : null}
      {state.status === "loaded" && state.licenses.length > 0 ? (
        <ul className="flex flex-col divide-y divide-default">
          {state.licenses.map((license) => (
            <LicenseItem key={`${license.name}@${license.version}`} license={license} />
          ))}
        </ul>
      ) : null}
    </main>
  );
}

/**
 * 1パッケージのライセンス。
 * 全文は長いため折りたたんで表示する。
 */
function LicenseItem({ license }: { license: DependencyLicense }) {
  const messages = useMessages(licensesMessages);
  return (
    <li className="flex flex-col gap-1 py-3">
      <h2 className="font-semibold break-all">
        {license.name} <span className="font-normal text-muted">{license.version}</span>
      </h2>
      <p className="text-sm">
        {messages.identifier}: {license.identifier ?? messages.unknownIdentifier}
      </p>
      {license.text === undefined ? (
        <p className="text-sm text-muted">{messages.noText}</p>
      ) : (
        <details>
          <summary className="cursor-pointer text-sm underline">{messages.showText}</summary>
          <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">{license.text}</pre>
        </details>
      )}
    </li>
  );
}
