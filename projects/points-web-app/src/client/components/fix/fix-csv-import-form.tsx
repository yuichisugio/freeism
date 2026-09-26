import { useEffect, useState } from "react";

import { CsvValidationForm } from "../csv/csv-validation-form";

/**
 * FIX CSV の取込フォーム。
 * 受領者の照合に使う ACTIVE な接続先 Accounts を選んでから検証し、行ごとの照合結果を表示する。
 * @see ../../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 * @see ./fix-csv-import-form.test.tsx
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/** `GET /api/accounts-connections` の1件。 */
export type AccountsConnectionOption = { id: string; displayName: string; accountsOrigin: string };

/** FIX CSV の validate の応答。 */
export type FixCsvValidation = {
  accountsOrigin: string | null;
  accountsResolution:
    | { status: "COMPLETE" }
    | { status: "UNAVAILABLE"; code: string; retryAfter: string | null };
  rowCount: number;
  rows: { recipientLinked: boolean; resolution: FixRecipientResolution; row: number }[];
  validationHash: string | null;
};

type FixRecipientResolution = "MATCHED" | "NO_MATCH" | "UNRESOLVED";

// --------------------------------------------------
// 照合結果
// --------------------------------------------------

/** 行の照合結果の表示文言。 */
function describeRow({ recipientLinked, resolution }: FixCsvValidation["rows"][number]): string {
  if (resolution === "UNRESOLVED") return "未照合（通信失敗）";
  if (resolution === "NO_MATCH") return "該当なし（未受領として保存）";
  return recipientLinked ? "一致（Points連携あり）" : "一致（Points未連携のため未受領として保存）";
}

/**
 * 検証結果の照合結果を表示する。
 * 照合できなかった場合は、確定できないことと再試行の目安を示す。
 */
export function FixRecipientResolutionSummary({
  validation,
}: Readonly<{ validation: FixCsvValidation }>) {
  const { accountsResolution, rows } = validation;
  const counts = {
    linked: rows.filter((row) => row.resolution === "MATCHED" && row.recipientLinked).length,
    unlinked: rows.filter((row) => row.resolution === "MATCHED" && !row.recipientLinked).length,
    noMatch: rows.filter((row) => row.resolution === "NO_MATCH").length,
  };
  return (
    <div className="status-card" aria-live="polite">
      {accountsResolution.status === "UNAVAILABLE" ? (
        <p role="alert">
          Accountsで受領者を照合できなかったため、確定できません（{accountsResolution.code}）。
          {accountsResolution.retryAfter
            ? `${accountsResolution.retryAfter}秒後に`
            : "時間をおいて"}
          もう一度確認してください。
        </p>
      ) : (
        <p>
          照合先: {validation.accountsOrigin} / 一致（Points連携あり） {counts.linked}件 /
          一致（Points未連携） {counts.unlinked}件 / 該当なし {counts.noMatch}件
        </p>
      )}
      <details>
        <summary>行ごとの照合結果</summary>
        <ul>
          {rows.map((row) => (
            <li key={row.row}>
              {row.row}行: {describeRow(row)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// --------------------------------------------------
// フォーム
// --------------------------------------------------

/**
 * 接続先を選び、FIX CSV を検証・確定する。
 * @param connections 接続先の一覧（省略時は `GET /api/accounts-connections` から読む）
 */
export function FixCsvImportForm({
  connections: initialConnections,
}: Readonly<{ connections?: AccountsConnectionOption[] }>) {
  const [connections, setConnections] = useState<AccountsConnectionOption[] | null>(
    initialConnections ?? null,
  );
  const [connectionId, setConnectionId] = useState(initialConnections?.[0]?.id ?? "");

  useEffect(() => {
    if (initialConnections) return;
    void fetch("/api/accounts-connections")
      .then((response) => response.json() as Promise<{ data?: AccountsConnectionOption[] }>)
      .then(({ data = [] }) => {
        setConnections(data);
        setConnectionId(data[0]?.id ?? "");
      });
  }, [initialConnections]);

  return (
    <>
      <section className="form-card" aria-labelledby="fix-accounts-connection-heading">
        <h2 id="fix-accounts-connection-heading">受領者の照合先</h2>
        {connections === null ? (
          <p>接続先を読み込んでいます…</p>
        ) : connections.length === 0 ? (
          <p className="status-card status-error" role="alert">
            接続先Accountsが未設定です。運営者画面で接続先を追加し、有効化してください。
          </p>
        ) : (
          <label>
            接続先Accounts
            <select onChange={(event) => setConnectionId(event.target.value)} value={connectionId}>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.displayName}（{connection.accountsOrigin}）
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      <CsvValidationForm<FixCsvValidation>
        disabled={connectionId === ""}
        endpoint="/api/admin/fixes/csv"
        headers={{ "X-Accounts-Connection-Id": connectionId }}
        key={connectionId}
        renderValidation={(validation) => <FixRecipientResolutionSummary validation={validation} />}
        title="FIX結果"
      />
    </>
  );
}
