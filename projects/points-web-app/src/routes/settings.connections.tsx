import { createFileRoute } from "@tanstack/react-router";

import { AccountsLinksPanel } from "../client/components/accounts/accounts-links-panel";
import { EmptyState, OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/settings/connections")({ component: ConnectionsPage });

export function ConnectionsPage() {
  return (
    <OperationPage
      description="AccountsとMarketsとの連携を管理します。"
      eyebrow="Settings"
      title="外部連携"
    >
      <AccountsLinksPanel />
      <section className="form-card">
        <h2>Freeism Markets</h2>
        <EmptyState>Marketsとの有効な連携はありません。</EmptyState>
      </section>
    </OperationPage>
  );
}
