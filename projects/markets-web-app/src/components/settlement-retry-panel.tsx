import { useState } from "react";

import {
  createIdempotencyKey,
  type MarketsClient,
  type SafeSettlementStatus,
} from "../client/api/markets-client";
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

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await client.retrySettlement(settlement.settlementId, reason, {
        idempotencyKey: createIdempotencyKey("settlement_retry"),
      });
      onChanged();
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  if (settlement.state !== "ACTION_REQUIRED" || !settlement.manualActionAllowed) return null;
  return (
    <section aria-labelledby="settlement-retry-heading" className="sub-panel">
      <h2 id="settlement-retry-heading">手動確認</h2>
      <p>holdを維持したまま確認します。数量が復元済みとは限りません。</p>
      {error ? <ProblemBanner message={error} /> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim()) return;
          void retry();
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
          精算を再試行
        </button>
      </form>
    </section>
  );
}
