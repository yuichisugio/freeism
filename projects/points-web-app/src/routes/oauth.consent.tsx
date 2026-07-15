import { createFileRoute } from "@tanstack/react-router";

import { ConsentPanel } from "../client/components/oauth/consent-panel";
import { OperationPage } from "../client/components/operation-page";

export const Route = createFileRoute("/oauth/consent")({
  component: OAuthConsentPage,
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: typeof search.client_id === "string" ? search.client_id : "Freeism Markets",
    scope: typeof search.scope === "string" ? search.scope : "",
  }),
});

export function OAuthConsentPage() {
  const search = Route.useSearch();
  const scopes = search.scope.split(/\s+/).filter(Boolean);
  return (
    <OperationPage
      description="連携先と要求された権限を確認し、許可または拒否してください。"
      eyebrow="OAuth"
      title="連携を確認"
    >
      <ConsentPanel clientName={search.clientId} scopes={scopes} />
    </OperationPage>
  );
}
