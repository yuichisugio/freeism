import { useEffect, useState } from "react";

import { GoogleReauthButton } from "../auth/google-reauth-button";

export type AccountReopenPreview = {
  axes: Array<{
    evaluationCriterionId: string;
    negativeCount: number;
    netAmount: string;
    positiveCount: number;
    totalCount: number;
  }>;
  reopenSetHash: string;
};

export function AccountReopenPanel({ preview }: Readonly<{ preview?: AccountReopenPreview }>) {
  const [loadedPreview, setLoadedPreview] = useState<AccountReopenPreview | null>(preview ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const value = loadedPreview ?? { axes: [], reopenSetHash: "" };

  async function loadPreview() {
    const response = await fetch("/api/account/reopen-preview");
    if (!response.ok) {
      setMessage("未受領FIXを読み込めませんでした。");
      return;
    }
    const body = (await response.json()) as {
      data: {
        aggregates: Array<{
          evaluationCriterionId: string;
          negativeCount: number;
          netAmountScaled: number;
          positiveCount: number;
          totalCount: number;
        }>;
        reopenSetHash: string;
      };
    };
    setLoadedPreview({
      axes: body.data.aggregates.map(({ netAmountScaled, ...aggregate }) => ({
        ...aggregate,
        netAmount: String(netAmountScaled),
      })),
      reopenSetHash: body.data.reopenSetHash,
    });
  }

  useEffect(() => {
    if (!preview) void loadPreview();
  }, [preview]);

  async function reopen() {
    const response = await fetch("/api/account/reopen", {
      body: JSON.stringify({ reopenSetHash: value.reopenSetHash }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      method: "POST",
    });
    if (response.status === 409) void loadPreview();
    setMessage(
      response.status === 409
        ? "未受領結果が変わりました。最新の内容へ更新したので再確認してください。"
        : response.ok
          ? "アカウントを再開しました。"
          : "再開できませんでした。",
    );
  }

  return (
    <section className="form-card">
      <h2>未受領FIXの一括受領</h2>
      <p>
        正負すべてを選択せず一括で受領します。負の結果により残高がマイナスになる場合があります。
      </p>
      {value.axes.length === 0 ? (
        <p className="status-card">未受領のFIXはありません。</p>
      ) : (
        <ul className="signed-list">
          {value.axes.map((axis) => (
            <li key={axis.evaluationCriterionId}>
              <strong>{axis.netAmount}</strong>
              <span>{axis.evaluationCriterionId}</span>
              <small>
                正 {axis.positiveCount}件 / 負 {axis.negativeCount}件 / 全 {axis.totalCount}件
              </small>
            </li>
          ))}
        </ul>
      )}
      <GoogleReauthButton />
      <button onClick={() => void reopen()} type="button">
        正負すべてを一括受領して再開
      </button>
      {message ? (
        <p aria-live="polite" className="status-card">
          {message}
        </p>
      ) : null}
    </section>
  );
}
