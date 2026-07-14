import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

export function IndexPage() {
  return (
    <OperationPage
      description="ポイントの付与と管理を、履歴の残る台帳として扱います。"
      eyebrow="Balance infrastructure"
      title="Freeism Points"
    >
      <section className="form-card">
        <h2>ポイント残高</h2>
        <EmptyState>表示できるポイント残高はまだありません。</EmptyState>
        <a className="markets-link" href="https://markets.freeism.app">
          Freeism Marketsへ
        </a>
      </section>
    </OperationPage>
  );
}
