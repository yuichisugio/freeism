import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppFooter, AppHeader } from "../features/app-shell/components/app-header";
import { appShellMessages } from "../features/app-shell/messages";
import { LoginDialogProvider } from "../features/auth/components/login-dialog";
import { I18nProvider, useMessages } from "../lib/i18n/i18n-provider";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  // トップページだけ事前生成で画面の内容を描画し、ほかの画面はブラウザーで最初から描画する（`start.ts`の`defaultSsr: false`）。
  ssr: ({ location }) => location.pathname === "/",
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Accounts" },
    ],
    links: [
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
 */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * 全画面共通の枠。
 * ログイン用のダイアログは、どの画面からも開けるよう共通の枠に置く。
 */
function RootLayout() {
  return (
    <I18nProvider>
      <LoginDialogProvider>
        <AppHeader />
        <Outlet />
        <AppFooter />
      </LoginDialogProvider>
    </I18nProvider>
  );
}

function NotFound() {
  const messages = useMessages(appShellMessages);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p>{messages.notFound}</p>
    </main>
  );
}
