import { createFileRoute } from "@tanstack/react-router";

import { PrivacyPolicyPage } from "../features/policies/components/policy-pages";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
});
