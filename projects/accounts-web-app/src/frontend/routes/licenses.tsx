import { createFileRoute } from "@tanstack/react-router";

import { LicensesPage } from "../features/licenses/components/licenses-page";

export const Route = createFileRoute("/licenses")({
  component: LicensesPage,
});
