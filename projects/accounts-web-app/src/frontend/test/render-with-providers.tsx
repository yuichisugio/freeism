import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach } from "vitest";

import { I18nProvider } from "../lib/i18n/i18n-provider";
import type { Language } from "../lib/i18n/language";

// vitestのglobalsを使わないため、Testing Libraryの自動cleanupの代わりに各テスト後に描画を片付ける。
afterEach(() => {
  cleanup();
});

/**
 * 表示言語とルーターを用意してビューを描画する。
 * ルーターの描画は非同期のため、テストでは`findBy*`で要素を待つ。
 */
export function renderWithProviders(ui: ReactNode, { language = "ja" }: { language?: Language } = {}) {
  const rootRoute = createRootRoute({
    component: () => <I18nProvider initialLanguage={language}>{ui}</I18nProvider>,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

/**
 * フックの単体テスト用に、表示言語だけを用意するwrapper。
 */
export function I18nTestWrapper({ children }: { children: ReactNode }) {
  return <I18nProvider initialLanguage="ja">{children}</I18nProvider>;
}
