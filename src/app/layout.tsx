import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Providers } from "@/components/provider/providers";
import { Analytics } from "@vercel/analytics/react";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Freeism-app",
  description: "Freeism-app by sugio",
  icons: {
    icon: "/favicon.svg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <html lang="ja" suppressHydrationWarning className="overflow-hidden">
      {/* suppressHydrationWarning={true} を追加することで、ブラウザ拡張機能（Grammarlyなど）が追加する属性によるハイドレーション警告を抑制します */}
      <body suppressHydrationWarning={true}>
        <Providers session={session}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
