import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { marketsClient, type MarketsClient } from "../../client/api/markets-client";
import { useApiResource } from "../../client/api/use-api-resource";
import { LocalDateTime } from "../../components/local-date-time";
import { ProblemBanner } from "../../components/problem-banner";
import { ProofReviews } from "../../components/proof-reviews";
import { TradeReviewForm } from "../../components/trade-review-form";

export const Route = createFileRoute("/proofs/$proofId")({
  component: ProofRoute,
  head: () => ({ meta: [{ title: "取引証明 | Freeism Markets" }] }),
});

function ProofRoute() {
  const { proofId } = Route.useParams();
  return <ProofPage proofId={proofId} />;
}

function identityName(identity: Record<string, unknown>) {
  const name = identity.displayName ?? identity.name;
  return typeof name === "string" ? name : "公開プロフィール";
}

export function ProofPage({
  client = marketsClient,
  proofId,
}: Readonly<{ client?: MarketsClient; proofId: string }>) {
  const loadProof = useCallback(() => client.proof(proofId), [client, proofId]);
  const loadReviews = useCallback(() => client.proofReviews(proofId), [client, proofId]);
  const proof = useApiResource(loadProof);
  const reviews = useApiResource(loadReviews);

  return (
    <main className="page-shell">
      <section aria-labelledby="proof-heading" className="ledger-panel">
        <p className="eyebrow">Immutable proof</p>
        <h1 id="proof-heading">取引証明</h1>
        <p>このページはログインなしで確認できます。</p>
        {proof.loading ? <p aria-live="polite">読み込み中…</p> : null}
        {proof.error ? <ProblemBanner message="取引証明を取得できません。" /> : null}
        {proof.data ? (
          <dl className="fact-list">
            <div>
              <dt>状態</dt>
              <dd>{proof.data.completionStatus}</dd>
            </div>
            <div>
              <dt>Seller</dt>
              <dd>{identityName(proof.data.seller)}</dd>
            </div>
            <div>
              <dt>Buyer</dt>
              <dd>{identityName(proof.data.buyer)}</dd>
            </div>
            <div>
              <dt>数量</dt>
              <dd>{proof.data.allocation.quantity}</dd>
            </div>
            <div>
              <dt>確定時刻</dt>
              <dd>
                <LocalDateTime value={proof.data.settledAt} />
              </dd>
            </div>
            <div>
              <dt>content hash</dt>
              <dd>
                <code>{proof.data.contentHash}</code>
              </dd>
            </div>
          </dl>
        ) : null}
        {reviews.error ? (
          <ProblemBanner message="レビューを取得できません。証明本文は変更されません。" />
        ) : null}
        <ProofReviews reviews={reviews.data ?? []} />
        <TradeReviewForm />
      </section>
    </main>
  );
}
