import { createFileRoute } from "@tanstack/react-router";

import { CsvExportPanel } from "../client/components/csv/csv-export-panel";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/settings/exports")({ component: ExportsPage });

export function ExportsPage() {
  return (
    <OperationPage
      description="同じスナップショットから1000行ずつCSVを保存します。"
      eyebrow="Settings"
      title="CSV export"
    >
      <CsvExportPanel />
    </OperationPage>
  );
}
