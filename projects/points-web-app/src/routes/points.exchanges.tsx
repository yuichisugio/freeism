import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/points/exchanges")({ component: ExchangesPage });

export function ExchangesPage() {
  return (
    <OperationPage
      description="交換レートを確認し、CSVの全行を1つの操作として確定します。"
      eyebrow="Point operation"
      title="ポイント交換"
    >
      <CsvValidationForm endpoint="/api/exchanges/csv" title="交換" />
    </OperationPage>
  );
}
