import { HeadContent, Outlet, ScriptOnce, Scripts, createRootRoute, useMatches } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppFooter, AppHeader } from "../features/app-shell/components/app-header";
import { PageMain } from "../features/app-shell/components/page-main";
import { appShellMessages } from "../features/app-shell/messages";
import { LoginDialogProvider } from "../features/auth/components/login-dialog";
import { I18nProvider, useMessages } from "../lib/i18n/i18n-provider";
import { themeInitScript } from "../lib/theme";
import appCss from "../styles.css?url";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * ヘッダーのタブとフッターを置かない画面か（同意画面）。
     */
    hidesNavigation?: boolean;
  }
}

/**
 * 画面の書体（見出し: Zen Maru Gothic、本文: Noto Sans JP、URL・ID: M PLUS 1 Code）。
 * @see ../../../docs/specification/v0.1/design-system.ja.md
 */
const fontStylesheetUrl =
  "https://fonts.googleapis.com/css2?family=M+PLUS+1+Code:wght@400;500&family=Noto+Sans+JP:wght@400;500;700&family=Zen+Maru+Gothic:wght@500;700&display=swap";

export const Route = createRootRoute({
  // トップページだけ事前生成で画面の内容を描画し、ほかの画面はブラウザーで最初から描画する（`start.ts`の`defaultSsr: false`）。
  ssr: ({ location }) => location.pathname === "/",
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Freeism Accounts" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: fontStylesheetUrl },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

/**
 * 事前生成するHTML文書。
 * `lang`は表示言語に合わせて`I18nProvider`が更新する。
 * テーマは初回描画のちらつきを避けるため、`<head>`のスクリプトで描画前に`<html>`の`data-theme`へ付ける（hydrationでは属性の差を許す）。
 */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeInitScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body className="min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * 全画面共通の枠。
 * ログイン用のダイアログは、どの画面からも開けるよう共通の枠に置く。
 * 同意画面（`staticData.hidesNavigation`）では、ヘッダーのタブとフッターを置かない。
 */
function RootLayout() {
  const hidesNavigation = useMatches({
    select: (matches) => matches.some((match) => match.staticData.hidesNavigation === true),
  });
  return (
    <I18nProvider>
      <LoginDialogProvider>
        <AppHeader hasTabs={!hidesNavigation} />
        <Outlet />
        {hidesNavigation ? null : <AppFooter />}
      </LoginDialogProvider>
    </I18nProvider>
  );
}

function NotFound() {
  const messages = useMessages(appShellMessages);
  return (
    <PageMain>
      <p className="py-14 text-center font-display text-xl font-bold">{messages.notFound}</p>
    </PageMain>
  );
}
