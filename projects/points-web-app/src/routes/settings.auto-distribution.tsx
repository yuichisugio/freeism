import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/settings/auto-distribution")({
  component: AutoDistributionPage,
});

export function AutoDistributionPage() {
  return (
    <OperationPage
      description="正のFIXを評価軸間で配分する設定をCSVで検証して確定します。"
      eyebrow="Settings"
      title="自動分配"
    >
      <CsvValidationForm endpoint="/api/settings/auto-distribution/csv" title="自動分配設定" />
    </OperationPage>
  );
}
