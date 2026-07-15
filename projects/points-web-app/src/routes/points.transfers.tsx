import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/points/transfers")({ component: TransfersPage });

export function TransfersPage() {
  return (
    <OperationPage
      description="譲渡内容をCSVで検証し、Google再認証後に一括確定します。"
      eyebrow="Point operation"
      title="ポイント譲渡"
    >
      <CsvValidationForm endpoint="/api/transfers/csv" title="譲渡" />
    </OperationPage>
  );
}
