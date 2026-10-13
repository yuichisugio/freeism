import { createFileRoute } from "@tanstack/react-router";

import { AccountsConnectionAdminPanel } from "../client/components/accounts/accounts-connection-admin-panel";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/accounts-connections")({
  component: AccountsConnectionsPage,
});

export function AccountsConnectionsPage() {
  return (
    <OperationPage
      description="PointsがOAuthクライアントとして接続するAccountsを管理します。取り下げると、その接続先への全ユーザーの連携が解除されます。"
      eyebrow="ADMIN"
      title="接続先Accounts"
    >
      <AccountsConnectionAdminPanel />
    </OperationPage>
  );
}
