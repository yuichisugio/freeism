import { createFileRoute } from "@tanstack/react-router";

import { AccountReopenPanel } from "../client/components/account/account-reopen-panel";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/account/reopen")({ component: AccountReopenPage });

export function AccountReopenPage() {
  return (
    <OperationPage
      description="アカウントを再開します。未受領FIXは、再開後に設定画面でAccountsと連携してから受領できます。"
      eyebrow="Account"
      title="アカウントを再開"
    >
      <AccountReopenPanel />
    </OperationPage>
  );
}
