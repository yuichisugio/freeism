import { createFileRoute } from "@tanstack/react-router";

import { AccountReopenPanel } from "../client/components/account/account-reopen-panel";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/account/reopen")({ component: AccountReopenPage });

export function AccountReopenPage() {
  return (
    <OperationPage
      description="閉鎖中に永久OAuth主体へ届いた正負すべてのFIXを確認し、一括受領して再開します。"
      eyebrow="Account"
      title="アカウントを再開"
    >
      <AccountReopenPanel />
    </OperationPage>
  );
}
