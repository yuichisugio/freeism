import { useCallback, useEffect, useState } from "react";

import { GoogleReauthButton } from "../auth/google-reauth-button";
import type { AccountsLinkView } from "./accounts-links-panel";

/**
 * 設定画面の「未受領FIX」区画。
 * Accounts連携ごとに、Accountsの現在の照合で受領できる未受領FIXを確認し、正負すべてを一括で受領する。
 * @see ../../../backend/http/routes/unclaimed-fix-routes.ts
 * @see ./unclaimed-fix-claim-panel.test.tsx
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

export type UnclaimedFixClaimPreview = {
  accountsLinkId: string;
  aggregates: {
    evaluationCriterionId: string;
    negativeCount: number;
    netAmountScaled: number;
    positiveCount: number;
    totalCount: number;
  }[];
  claimSetHash: string;
  totalCount: number;
};

// --------------------------------------------------
// 表示
// --------------------------------------------------

/** ポイント量の保存単位（小数4桁）。 */
const pointScale = 10_000;

/** 保存単位の整数を、小数4桁までの10進表記にする。 */
function formatScaledAmount(amountScaled: number): string {
  const sign = amountScaled < 0 ? "-" : "";
  const absolute = Math.abs(amountScaled);
  const fraction = String(absolute % pointScale)
    .padStart(4, "0")
    .replace(/0+$/, "");
  return `${sign}${Math.trunc(absolute / pointScale)}${fraction ? `.${fraction}` : ""}`;
}

/** 受領の失敗を利用者向けの案内にする。 */
export function claimProblemMessage(code: string): string {
  if (code === "FRESH_GOOGLE_AUTH_REQUIRED")
    return "受領にはGoogleで再認証が必要です。再認証してから、もう一度お試しください。";
  if (code === "CLAIM_SET_CHANGED")
    return "受領できる未受領FIXが変わりました。最新の内容を確認してから受領してください。";
  if (code === "ACCOUNTS_UNAVAILABLE" || code === "ACCOUNTS_CLIENT_UNAUTHORIZED")
    return "Accountsに接続できませんでした。時間をおいて、もう一度お試しください。";
  return "受領できませんでした。";
}

export function UnclaimedFixClaimPreviewView({
  onClaim,
  pending,
  preview,
}: Readonly<{ onClaim: () => void; pending: boolean; preview: UnclaimedFixClaimPreview }>) {
  if (preview.totalCount === 0) return <p>受領できる未受領FIXはありません。</p>;
  return (
    <>
      <ul className="signed-list">
        {preview.aggregates.map((aggregate) => (
          <li key={aggregate.evaluationCriterionId}>
            <strong>{formatScaledAmount(aggregate.netAmountScaled)}</strong>
            <span>{aggregate.evaluationCriterionId}</span>
            <small>
              {`正 ${aggregate.positiveCount}件 / 負 ${aggregate.negativeCount}件 / 全 ${aggregate.totalCount}件`}
            </small>
          </li>
        ))}
      </ul>
      <button disabled={pending} onClick={onClaim} type="button">
        正負すべてを一括で受領する
      </button>
    </>
  );
}

// --------------------------------------------------
// 区画
// --------------------------------------------------

/**
 * 連携ごとの preview と一括受領を行う区画。
 * 受領は Google の再認証後に行い、preview と集合が変わっていれば最新の preview を示す。
 */
export function UnclaimedFixClaimPanel() {
  const [links, setLinks] = useState<AccountsLinkView[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, UnclaimedFixClaimPreview>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const loadLinks = useCallback(async () => {
    const response = await fetch("/api/accounts-links");
    if (!response.ok) {
      setMessage("Accounts連携を読み込めませんでした。");
      return;
    }
    setLinks(((await response.json()) as { data: AccountsLinkView[] }).data);
  }, []);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  function showPreview(preview: UnclaimedFixClaimPreview) {
    setPreviews((current) => ({ ...current, [preview.accountsLinkId]: preview }));
  }

  async function loadPreview(accountsLinkId: string) {
    setPending(true);
    const response = await fetch(
      `/api/unclaimed-fixes/claim-preview?${new URLSearchParams({ accountsLinkId }).toString()}`,
    );
    setPending(false);
    if (!response.ok) {
      setMessage(claimProblemMessage(((await response.json()) as { code: string }).code));
      return;
    }
    setMessage(null);
    showPreview(((await response.json()) as { data: UnclaimedFixClaimPreview }).data);
  }

  async function claim(preview: UnclaimedFixClaimPreview) {
    setPending(true);
    const response = await fetch("/api/unclaimed-fixes/claims", {
      body: JSON.stringify({
        accountsLinkId: preview.accountsLinkId,
        claimSetHash: preview.claimSetHash,
      }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      method: "POST",
    });
    setPending(false);
    if (response.ok) {
      setNeedsReauth(false);
      const { data } = (await response.json()) as { data: { claimedCount: number } };
      await loadPreview(preview.accountsLinkId);
      setMessage(`未受領FIXを${data.claimedCount}件受領しました。`);
      return;
    }
    const problem = (await response.json()) as { code: string; data?: UnclaimedFixClaimPreview };
    if (problem.code === "CLAIM_SET_CHANGED" && problem.data) showPreview(problem.data);
    setNeedsReauth(problem.code === "FRESH_GOOGLE_AUTH_REQUIRED");
    setMessage(claimProblemMessage(problem.code));
  }

  return (
    <section className="form-card">
      <h2>未受領FIX</h2>
      <p>
        Accountsで連携中のアカウントに照合されたFIXを受領します。正負すべてを選択せず一括で受領するため、残高がマイナスになる場合があります。
      </p>
      {message ? (
        <p aria-live="polite" className="status-card">
          {message}
        </p>
      ) : null}
      {links === null ? null : links.length === 0 ? (
        <p>Accountsと連携すると、照合された未受領FIXを受領できます。</p>
      ) : (
        <ul className="signed-list">
          {links.map((link) => {
            const preview = previews[link.id];
            return (
              <li key={link.id}>
                <strong>{`${link.accountsConnection.displayName}（${link.accountsUserId}）`}</strong>
                {preview ? (
                  <UnclaimedFixClaimPreviewView
                    onClaim={() => void claim(preview)}
                    pending={pending}
                    preview={preview}
                  />
                ) : null}
                <button
                  className="secondary-button"
                  disabled={pending}
                  onClick={() => void loadPreview(link.id)}
                  type="button"
                >
                  受領できるFIXを確認
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {needsReauth ? <GoogleReauthButton /> : null}
    </section>
  );
}
