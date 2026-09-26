import { createFileRoute } from "@tanstack/react-router";

import { TermsOfUsePage } from "../../features/policies/components/policy-pages";

export const Route = createFileRoute("/{-$accountsUserId}/terms")({
  // ユーザーの情報を扱わないため、URLのユーザーでログインしていなくても表示する。
  staticData: { isUserIndependent: true },
  component: TermsOfUsePage,
});
