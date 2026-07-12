import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

export function IndexPage() {
  return (
    <main className="page-shell points-home">
      <section className="ledger-panel" aria-labelledby="points-heading">
        <p className="eyebrow">Balance infrastructure</p>
        <h1 id="points-heading">Freeism Points</h1>
        <p className="lede">ポイントの付与と管理を、履歴の残る台帳として扱います。</p>
        <div className="service-note">
          <span className="fix-marker">FIX</span>
          <p>Marketsでの取引は、専用サービスから確認できます。</p>
        </div>
        <a className="markets-link" href="https://markets.freeism.app">
          Freeism Marketsへ
        </a>
      </section>
    </main>
  );
}
