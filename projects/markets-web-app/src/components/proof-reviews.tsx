import type { PublicProofReview } from "../client/api/markets-client";

export function ProofReviews({ reviews }: Readonly<{ reviews: readonly PublicProofReview[] }>) {
  return (
    <section aria-labelledby="reviews-heading" className="sub-panel">
      <h2 id="reviews-heading">レビュー</h2>
      {reviews.length === 0 ? <p>レビューはまだありません。</p> : null}
      {reviews.map((review) => (
        <article key={review.revisionId}>
          <h3>{review.direction}</h3>
          <p>評価: {review.rating} / 5</p>
          <p>{review.comment}</p>
          {review.completionProofUrl ? <a href={review.completionProofUrl}>完了URL</a> : null}
        </article>
      ))}
    </section>
  );
}
