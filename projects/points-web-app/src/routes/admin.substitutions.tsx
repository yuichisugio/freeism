import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/substitutions")({
  component: SubstitutionsAdminPage,
});

export function SubstitutionsAdminPage() {
  return (
    <OperationPage
      description="代用計算結果をCSVで検証し、正負の差分を一括確定します。"
      eyebrow="ADMIN"
      title="ポイント代用"
    >
      <CsvValidationForm endpoint="/api/admin/substitutions/csv" title="代用結果" />
    </OperationPage>
  );
}
