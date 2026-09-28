import { createFileRoute } from "@tanstack/react-router";

import { ConsentPage } from "../../features/consent/components/consent-page";
import type { RawSearch } from "../../lib/search-params";

/**
 * 同意画面（OAuth Providerの`consentPage`）。
 * 署名付きクエリを`oauth2.consent`へ引き継ぐため、クエリはすべてそのまま残す。
 * IDの無い`/consent`で開いた場合は、クエリを保って現在のユーザーのID付きの経路へ移る（`UserScopeGate`）。
 * ヘッダーはロゴと人のアイコンだけにし、フッターを置かない。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const Route = createFileRoute("/{-$accountsUserId}/consent")({
  validateSearch: (search: Record<string, unknown>) => search as RawSearch,
  staticData: { hidesNavigation: true },
  component: ConsentRoute,
});

function ConsentRoute() {
  const search = Route.useSearch();
  return <ConsentPage search={search} />;
}
