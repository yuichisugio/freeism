import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach } from "vitest";

import { LoginDialogProvider } from "../features/auth/components/login-dialog";
import { I18nProvider } from "../lib/i18n/i18n-provider";
import type { Language } from "../lib/i18n/language";

// vitestのglobalsを使わないため、Testing Libraryの自動cleanupの代わりに各テスト後に描画を片付ける。
afterEach(() => {
  cleanup();
});

/**
 * 表示言語・ルーター・ログイン用のダイアログを用意してビューを描画する。
 * `path`は開いている画面のURLで、トップページ（`/`）とAccountsユーザーID付きの画面（`/{accountsUserId}/...`）を扱える。
 * ルーターの描画は非同期のため、テストでは`findBy*`で要素を待つ。
 */
export function renderWithProviders(
  ui: ReactNode,
  { language = "ja", path = "/" }: { language?: Language; path?: string } = {},
) {
  const rootRoute = createRootRoute({
    component: () => (
      <I18nProvider initialLanguage={language}>
        <LoginDialogProvider>{ui}</LoginDialogProvider>
      </I18nProvider>
    ),
  });
  // 画面の経路と同じく、AccountsユーザーIDを任意で先頭に付ける。
  const userScopeRoute = createRoute({ getParentRoute: () => rootRoute, path: "{-$accountsUserId}" });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/" }),
    userScopeRoute.addChildren(
      ["account-links", "settings", "developer", "help"].map((path) =>
        createRoute({ getParentRoute: () => userScopeRoute, path }),
      ),
    ),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return { ...render(<RouterProvider router={router} />), router };
}
