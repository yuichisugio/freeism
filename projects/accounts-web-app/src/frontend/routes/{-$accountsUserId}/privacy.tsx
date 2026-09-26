import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPolicyPage } from "../../features/policies/components/policy-pages";

export const Route = createFileRoute("/{-$accountsUserId}/privacy")({
  // ユーザーの情報を扱わないため、URLのユーザーでログインしていなくても表示する。
  staticData: { isUserIndependent: true },
  component: PrivacyPolicyPage,
});
