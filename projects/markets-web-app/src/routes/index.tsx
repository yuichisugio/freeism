import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

export function IndexPage() {
  return (
    <main className="page-shell markets-home">
      <section className="ledger-panel" aria-labelledby="markets-heading">
        <p className="eyebrow">Auction marketplace</p>
        <h1 id="markets-heading">Freeism Markets</h1>
        <p className="lede">商材の出品とAuction作成を行います。</p>
        <div className="service-note">
          <span className="fix-marker">AUCTION</span>
          <p>ポイントの付与と管理は、専用サービスから確認できます。</p>
        </div>
        <a className="points-link" href="https://points.freeism.app">
          Freeism Pointsへ
        </a>
      </section>
    </main>
  );
}
