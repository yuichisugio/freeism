import { useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../../client/api/markets-client";
import { useApiResource } from "../../../client/api/use-api-resource";
import { LocalDateTime } from "../../../components/local-date-time";
import { ProblemBanner } from "../../../components/problem-banner";
import { SettlementRetryPanel } from "../../../components/settlement-retry-panel";

export const Route = createFileRoute("/settlements/$settlementId/")({
  component: SettlementRoute,
  head: () => ({ meta: [{ title: "Settlement | Freeism Markets" }] }),
});

function SettlementRoute() {
  const { settlementId } = Route.useParams();
  return <SettlementPage settlementId={settlementId} />;
}

export function SettlementPage({
  client = marketsClient,
  settlementId,
}: Readonly<{ client?: MarketsClient; settlementId: string }>) {
  const load = useCallback(() => client.settlement(settlementId), [client, settlementId]);
  const resource = useApiResource(load);
  const terminal = resource.data?.state === "SETTLED" || resource.data?.state === "FAILED_RESTORED";

  useEffect(() => {
    if (!resource.data || terminal) return;
    const timer = window.setInterval(resource.reload, 3_000);
    return () => window.clearInterval(timer);
  }, [resource.data, resource.reload, terminal]);

  return (
    <main className="page-shell">
      <section aria-labelledby="settlement-heading" className="ledger-panel">
        <p className="eyebrow">Settlement status</p>
        <h1 id="settlement-heading">Settlement</h1>
        <p>処理中の状態は購入完了ではありません。安全な公開項目だけを表示します。</p>
        {resource.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {resource.error ? (
          <ProblemBanner message="Settlement状態を取得できません。完了とは扱いません。" />
        ) : null}
        {resource.data ? (
          <>
            <dl className="fact-list">
              <div>
                <dt>種別</dt>
                <dd>{resource.data.kind}</dd>
              </div>
              <div>
                <dt>状態</dt>
                <dd>{resource.data.state}</dd>
              </div>
              <div>
                <dt>進捗</dt>
                <dd>{resource.data.progress}</dd>
              </div>
              <div>
                <dt>更新</dt>
                <dd>
                  <LocalDateTime value={resource.data.updatedAt} />
                </dd>
              </div>
            </dl>
            {resource.data.state === "SETTLED" ? (
              <p>
                精算が完了しました。<a href="/me/auctions/won">落札履歴を確認</a>
              </p>
            ) : null}
            {resource.data.state === "FAILED_RESTORED" ? (
              <p>購入は成立せず、数量は復元済みです。再試行操作はありません。</p>
            ) : null}
            <SettlementRetryPanel
              client={client}
              onChanged={resource.reload}
              settlement={resource.data}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}
