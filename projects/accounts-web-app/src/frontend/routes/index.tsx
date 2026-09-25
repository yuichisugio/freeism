import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "../features/auth/components/login-page";

export const Route = createFileRoute("/")({
  // OAuth Providerの署名付きクエリを保つため、ほかのパラメータも値のまま残す。
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    ...search,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LoginRoute,
});

/**
 * ログイン画面。
 * ログイン失敗時は、Better Authが`?error=`を付けてこの画面へ戻す。
 */
function LoginRoute() {
  const { error } = Route.useSearch();
  return <LoginPage errorCode={error} />;
}
