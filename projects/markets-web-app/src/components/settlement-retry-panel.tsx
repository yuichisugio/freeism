import { useState } from "react";

import {
  createIdempotencyKey,
  type MarketsClient,
  type SafeSettlementStatus,
} from "../client/api/markets-client";
import { LocalDateTime } from "./local-date-time";
import { ProblemBanner } from "./problem-banner";

export function SettlementRetryPanel({
  client,
  onChanged,
  settlement,
}: Readonly<{
  client: MarketsClient;
  onChanged: () => void;
  settlement: SafeSettlementStatus;
}>) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(operation: () => Promise<unknown>, redirect = false) {
    setBusy(true);
    setError(null);
    try {
      const result = (await operation()) as { authorizationUrl?: string };
      if (redirect && result.authorizationUrl) window.location.assign(result.authorizationUrl);
      else onChanged();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  if (settlement.state !== "ACTION_REQUIRED" || !settlement.manualActionAllowed) return null;
  const pending = settlement.pendingRetryAuthorization ?? null;
  return (
    <section aria-labelledby="settlement-retry-heading" className="sub-panel">
      <h2 id="settlement-retry-heading">手動確認</h2>
      <p>holdを維持したまま確認します。数量が復元済みとは限りません。</p>
      {error ? <ProblemBanner message={error} /> : null}
      {pending ? (
        <div>
          <p>
            Points管理者確認済み（期限: <LocalDateTime value={pending.expiresAt} />）
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(() =>
                client.confirmSettlementRetry(settlement.settlementId, pending.pendingId, {
                  idempotencyKey: createIdempotencyKey("settlement_retry_confirm"),
                }),
              )
            }
            type="button"
          >
            対象を再確認して実行
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) return;
            void run(
              () =>
                client.startSettlementRetry(settlement.settlementId, reason, {
                  idempotencyKey: createIdempotencyKey("settlement_retry_start"),
                }),
              true,
            );
          }}
        >
          <label htmlFor="settlement-retry-reason">確認理由（必須）</label>
          <textarea
            id="settlement-retry-reason"
            maxLength={500}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
            value={reason}
          />
          <button disabled={busy || !reason.trim()} type="submit">
            Pointsで重要操作を確認
          </button>
        </form>
      )}
    </section>
  );
}
