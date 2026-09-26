import { createFileRoute } from "@tanstack/react-router";

import { AccountsLinksPanel } from "../client/components/accounts/accounts-links-panel";
import { UnclaimedFixClaimPanel } from "../client/components/accounts/unclaimed-fix-claim-panel";
import { EmptyState, OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/settings/connections")({ component: ConnectionsPage });

export function ConnectionsPage() {
  return (
    <OperationPage
      description="AccountsとMarketsとの連携と、未受領FIXの受領を管理します。"
      eyebrow="Settings"
      title="外部連携"
    >
      <AccountsLinksPanel />
      <UnclaimedFixClaimPanel />
      <section className="form-card">
        <h2>Freeism Markets</h2>
        <EmptyState>Marketsとの有効な連携はありません。</EmptyState>
      </section>
    </OperationPage>
  );
}
