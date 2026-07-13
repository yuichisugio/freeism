import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../client/api/markets-client";
import { useApiResource } from "../../client/api/use-api-resource";
import { PointsConnectionPanel } from "../../components/points-connection-panel";
import { ProblemBanner } from "../../components/problem-banner";

export const Route = createFileRoute("/settings/points-connection")({
  component: PointsConnectionPage,
  head: () => ({ meta: [{ title: "Points連携 | Freeism Markets" }] }),
});

export function PointsConnectionPage({
  client = marketsClient,
}: Readonly<{ client?: MarketsClient }>) {
  const load = useCallback(() => client.pointsConnection(), [client]);
  const resource = useApiResource(load);
  return (
    <main className="page-shell">
      <section aria-labelledby="points-heading" className="ledger-panel">
        <p className="eyebrow">Account connection</p>
        <h1 id="points-heading">Points連携</h1>
        <p>MarketsとPointsは、明示的な確認後に1対1で連携します。</p>
        {resource.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {resource.error ? (
          <>
            <ProblemBanner message="現在この連携情報を取得できません。架空の連携状態は表示しません。" />
            <button onClick={resource.reload} type="button">
              再読み込み
            </button>
          </>
        ) : null}
        {resource.data ? (
          <PointsConnectionPanel
            client={client}
            onChanged={resource.reload}
            state={resource.data}
          />
        ) : null}
      </section>
    </main>
  );
}
