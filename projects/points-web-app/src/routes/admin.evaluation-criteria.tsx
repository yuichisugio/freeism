import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/evaluation-criteria")({
  component: EvaluationCriteriaAdminPage,
});

export function EvaluationCriteriaAdminPage() {
  return (
    <OperationPage
      description="評価軸と最小単位をCSVで検証し、新しい不変revisionとして確定します。"
      eyebrow="ADMIN"
      title="評価軸"
    >
      <CsvValidationForm endpoint="/api/admin/evaluation-criteria/csv" title="評価軸" />
    </OperationPage>
  );
}
