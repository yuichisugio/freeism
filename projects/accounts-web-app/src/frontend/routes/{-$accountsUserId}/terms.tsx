import { createFileRoute } from "@tanstack/react-router";

import { TermsOfUsePage } from "../../features/policies/components/policy-pages";

export const Route = createFileRoute("/{-$accountsUserId}/terms")({
  component: TermsOfUsePage,
});
