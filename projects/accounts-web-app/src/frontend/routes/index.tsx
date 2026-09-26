import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../features/home/components/home-page";

export const Route = createFileRoute("/")({
  // 簡単な使い方の静的な内容を、ビルド時に`index.html`へ事前生成する。
  ssr: true,
  // OAuth Providerの署名付きクエリを保つため、ほかのパラメータも値のまま残す。
  validateSearch: (search: Record<string, unknown>): { error?: string; sig?: string } => ({
    ...search,
    error: typeof search.error === "string" ? search.error : undefined,
    sig: typeof search.sig === "string" ? search.sig : undefined,
  }),
  component: HomeRoute,
});

/**
 * トップページ。
 * OAuth Providerのログイン画面（署名付きクエリ`sig`付き）と、ログイン失敗時にBetter Authが`?error=`を付けて戻す先を兼ねる。
 * どちらの場合もログイン用のダイアログを開く。
 */
function HomeRoute() {
  const { error, sig } = Route.useSearch();
  const loginRequest = sig === undefined && error === undefined ? null : { errorCode: error };
  return <HomePage loginRequest={loginRequest} />;
}
