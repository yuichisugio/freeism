import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppFooter, AppHeader } from "../features/app-shell/components/app-header";
import { appShellMessages } from "../features/app-shell/messages";
import { I18nProvider, useMessages } from "../lib/i18n/i18n-provider";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Accounts" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

/**
 * SPAのshellとして事前生成するHTML文書。
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
 */
function RootLayout() {
  return (
    <I18nProvider>
      <AppHeader />
      <Outlet />
      <AppFooter />
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
