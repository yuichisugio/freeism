import { useState } from "react";

import { GoogleReauthButton } from "../auth/google-reauth-button";
import { ProviderButtons } from "../auth/provider-buttons";

export function OwnershipPanel() {
  const [accountId, setAccountId] = useState("");
  const [ownershipId, setOwnershipId] = useState("");
  const [claimPreview, setClaimPreview] = useState<{
    aggregates: Array<{
      evaluationCriterionId: string;
      negativeCount: number;
      netAmountScaled: number;
      positiveCount: number;
      totalCount: number;
    }>;
    claimSetHash: string;
  } | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function verifyWeb() {
    const response = await fetch("/api/ownership/web/verify", {
      body: JSON.stringify({ url }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      method: "POST",
    });
    setMessage(
      response.ok
        ? "Webページのリンクを確認しました。"
        : "リンクが一致しません。プロフィールURLを確認してください。",
    );
  }

  async function changeGitHub(action: "deactivate" | "reactivate") {
    const response = await fetch(`/api/ownership/github/${action}`, {
      body: JSON.stringify({ accountId }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      method: "POST",
    });
    setMessage(
      response.ok
        ? `GitHub所有権を${action === "reactivate" ? "再有効化" : "停止"}しました。`
        : "GitHub所有権を変更できませんでした。Google再認証とAccount IDを確認してください。",
    );
  }

  async function previewClaim() {
    const response = await fetch(`/api/ownership/${encodeURIComponent(ownershipId)}/claim-preview`);
    const body = (await response.json()) as { data?: typeof claimPreview };
    if (!response.ok || !body.data) {
      setMessage("未受領FIXを確認できませんでした。");
      return;
    }
    setClaimPreview(body.data);
  }

  async function claimAll() {
    if (!claimPreview) return;
    const response = await fetch(`/api/ownership/${encodeURIComponent(ownershipId)}/claim`, {
      body: JSON.stringify({ claimSetHash: claimPreview.claimSetHash }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      method: "POST",
    });
    if (response.status === 409) {
      await previewClaim();
      setMessage("未受領結果が変わりました。最新の内容を再確認してください。");
      return;
    }
    setMessage(
      response.ok ? "正負すべての未受領FIXを受領しました。" : "未受領FIXを受領できませんでした。",
    );
    if (response.ok) setClaimPreview(null);
  }

  return (
    <div className="card-grid">
      <section className="form-card">
        <h2>GitHub</h2>
        <p>所有権確認専用です。ログイン時と同じProvider一覧から明示的に連携します。</p>
        <ProviderButtons mode="link" />
        <label>
          GitHub Account ID{" "}
          <input onChange={(event) => setAccountId(event.target.value)} value={accountId} />
        </label>
        <button
          className="secondary-button"
          disabled={!accountId}
          onClick={() => void changeGitHub("reactivate")}
          type="button"
        >
          停止中のGitHub所有権を再有効化
        </button>
        <button
          className="secondary-button"
          disabled={!accountId}
          onClick={() => void changeGitHub("deactivate")}
          type="button"
        >
          GitHub所有権を停止
        </button>
      </section>
      <section className="form-card">
        <h2>Webページ</h2>
        <p>外部ページにPointsプロフィールURLを掲載し、30日ごとに再検証します。</p>
        <label>
          検証するURL{" "}
          <input onChange={(event) => setUrl(event.target.value)} type="url" value={url} />
        </label>
        <button disabled={!url} onClick={() => void verifyWeb()} type="button">
          リンクを検証・再検証
        </button>
        {message ? (
          <p aria-live="polite" className="status-card">
            {message}
          </p>
        ) : null}
      </section>
      <section className="form-card">
        <h2>未受領FIX</h2>
        <p>所有権に紐づく正負すべての結果を、選択せず一括で受領します。</p>
        <GoogleReauthButton />
        <label>
          Ownership ID{" "}
          <input
            onChange={(event) => {
              setOwnershipId(event.target.value);
              setClaimPreview(null);
            }}
            value={ownershipId}
          />
        </label>
        <button disabled={!ownershipId} onClick={() => void previewClaim()} type="button">
          受領内容を確認
        </button>
        {claimPreview ? (
          <>
            <ul className="signed-list">
              {claimPreview.aggregates.map((item) => (
                <li key={item.evaluationCriterionId}>
                  <strong>{item.netAmountScaled}</strong>
                  <span>{item.evaluationCriterionId}</span>
                  <small>
                    正 {item.positiveCount}件 / 負 {item.negativeCount}件 / 全 {item.totalCount}件
                  </small>
                </li>
              ))}
            </ul>
            <button onClick={() => void claimAll()} type="button">
              正負すべてを受領
            </button>
          </>
        ) : null}
      </section>
      {message ? (
        <p aria-live="polite" className="status-card">
          {message}
        </p>
      ) : null}
    </div>
  );
}
