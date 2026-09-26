import { createFileRoute } from "@tanstack/react-router";

import { LicensesPage } from "../../features/licenses/components/licenses-page";

export const Route = createFileRoute("/{-$accountsUserId}/licenses")({
  // ユーザーの情報を扱わないため、URLのユーザーでログインしていなくても表示する。
  staticData: { isUserIndependent: true },
  component: LicensesPage,
});
