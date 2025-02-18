import type { Metadata } from "next";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Freeism-app",
  description: "Freeism-app by sugio",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="ja">
      {/* suppressHydrationWarning={true} を追加することで、ブラウザ拡張機能（Grammarlyなど）が追加する属性によるハイドレーション警告を抑制します */}
      <body suppressHydrationWarning={true}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
