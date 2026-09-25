import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "../features/auth/components/login-page";

export const Route = createFileRoute("/")({
  // OAuth Providerの署名付きクエリを保つため、ほかのパラメータも値のまま残す。
  validateSearch: (search: Record<string, unknown>): { error?: string; sig?: string } => ({
    ...search,
    error: typeof search.error === "string" ? search.error : undefined,
    sig: typeof search.sig === "string" ? search.sig : undefined,
  }),
  component: LoginRoute,
});

/**
 * ログイン画面。
 * ログイン失敗時は、Better Authが`?error=`を付けてこの画面へ戻す。
 * 署名付きクエリ（`sig`）を外して開き直した場合は、期限切れなどの表示を残さないよう画面を作り直す。
 */
function LoginRoute() {
  const { error, sig } = Route.useSearch();
  return <LoginPage key={sig ?? ""} errorCode={error} />;
}
