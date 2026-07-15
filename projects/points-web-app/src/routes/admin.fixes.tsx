import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/fixes")({ component: FixesAdminPage });

export function FixesAdminPage() {
  return (
    <OperationPage
      description="FIX結果を検証し、不変revisionと差分ledgerとして一括確定します。"
      eyebrow="ADMIN"
      title="FIX結果"
    >
      <CsvValidationForm endpoint="/api/admin/fixes/csv" title="FIX結果" />
    </OperationPage>
  );
}
