import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/exchange-rates")({
  component: ExchangeRatesAdminPage,
});

export function ExchangeRatesAdminPage() {
  return (
    <OperationPage
      description="評価軸間の交換比率をCSVで検証し、新しいrevisionとして確定します。"
      eyebrow="ADMIN"
      title="交換比率"
    >
      <CsvValidationForm endpoint="/api/admin/exchange-rates/csv" title="交換比率" />
    </OperationPage>
  );
}
