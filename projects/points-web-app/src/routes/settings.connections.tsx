import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/settings/connections")({ component: ConnectionsPage });

export function ConnectionsPage() {
  return (
    <OperationPage
      description="Marketsとの明示連携を管理します。"
      eyebrow="Settings"
      title="外部連携"
    >
      <section className="form-card">
        <h2>Freeism Markets</h2>
        <EmptyState>Marketsとの有効な連携はありません。</EmptyState>
      </section>
    </OperationPage>
  );
}
