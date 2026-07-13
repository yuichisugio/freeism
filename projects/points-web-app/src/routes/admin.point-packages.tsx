import { createFileRoute } from "@tanstack/react-router";

import { CsvValidationForm } from "../client/components/csv/csv-validation-form";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/admin/point-packages")({
  component: PointPackagesAdminPage,
});

export function PointPackagesAdminPage() {
  return (
    <OperationPage
      description="公式Packageの構成評価軸と重みをCSVで管理します。"
      eyebrow="ADMIN"
      title="公式Point Package"
    >
      <CsvValidationForm endpoint="/api/admin/point-packages/csv" title="Point Package" />
    </OperationPage>
  );
}
