import { createFileRoute } from "@tanstack/react-router";

import { HelpPage } from "../../features/help/components/help-page";

export const Route = createFileRoute("/{-$accountsUserId}/help")({
  // ユーザーの情報を扱わないため、URLのユーザーでログインしていなくても表示する。
  staticData: { isUserIndependent: true },
  component: HelpPage,
});
