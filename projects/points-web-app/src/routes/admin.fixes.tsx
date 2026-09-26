import { createFileRoute } from "@tanstack/react-router";

import { FixCsvImportForm } from "../client/components/fix/fix-csv-import-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/fixes")({ component: FixesAdminPage });

export function FixesAdminPage() {
  return (
    <OperationPage
      description="受領者を接続先Accountsで照合してFIX結果を検証し、不変revisionと差分ledgerとして一括確定します。"
      eyebrow="ADMIN"
      title="FIX結果"
    >
      <FixCsvImportForm />
    </OperationPage>
  );
}
