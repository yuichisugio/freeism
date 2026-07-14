import type { ReactNode } from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";

import { MarketsLocaleProvider } from "../client/i18n/markets-locale";
import { AppShell } from "../components/app-shell";
import { FIXED_PAGE_PRE_HYDRATION_SCRIPT } from "../content/fixed-page-language";
import stylesHref from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: [{ href: stylesHref, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "Freeism Markets" },
    ],
    scripts: [{ children: FIXED_PAGE_PRE_HYDRATION_SCRIPT }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <MarketsLocaleProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </MarketsLocaleProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
