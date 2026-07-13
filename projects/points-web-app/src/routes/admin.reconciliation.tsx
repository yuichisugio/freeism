import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GoogleReauthButton } from "../client/components/auth/google-reauth-button";
import { EmptyState, OperationPage, ProblemState } from "../client/components/operation-page";

type ReconciliationResult = { consistent?: boolean } & Record<string, unknown>;

export const Route = createFileRoute("/admin/reconciliation")({
  component: ReconciliationAdminPage,
});

export function ReconciliationAdminPage() {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [failed, setFailed] = useState(false);

  async function run() {
    setFailed(false);
    const response = await fetch("/api/reconciliation/run", {
      body: JSON.stringify({ reason }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      method: "POST",
    });
    const body = (await response.json()) as { data?: ReconciliationResult };
    if (!response.ok || !body.data) {
      setFailed(true);
      return;
    }
    setResult(body.data);
  }

  return (
    <OperationPage
      description="ledger、projection、ACTIVE予約、claim集合を読み取り専用で照合します。"
      eyebrow="ADMIN"
      title="Reconciliation"
    >
      <section className="form-card">
        <h2>手動照合</h2>
        <label>
          実行理由 <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
        </label>
        <GoogleReauthButton />
        <button disabled={!reason.trim()} onClick={() => void run()} type="button">
          照合を実行
        </button>
      </section>
      {failed ? (
        <ProblemState message="照合を実行できませんでした。" />
      ) : result ? (
        result.consistent ? (
          <EmptyState>差分はありません。</EmptyState>
        ) : (
          <pre className="status-card">{JSON.stringify(result, null, 2)}</pre>
        )
      ) : (
        <EmptyState>まだ照合を実行していません。</EmptyState>
      )}
    </OperationPage>
  );
}
