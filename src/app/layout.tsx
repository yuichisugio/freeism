import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "../styles/globals.css";

import { Providers } from "@/components/provider/providers";
import { getAuthSession } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "Freeism-app",
  description: "Freeism-app by sugio",
  icons: [
    {
      url: "/favicon.svg",
    },
    {
      url: "/icon192_maskable.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      url: "/icon512_maskable.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Freeism-app",
    statusBarStyle: "default",
  },
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ビューポート
 */
export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ルートレイアウト
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションを取得
   */
  const session = await getAuthSession();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  return (
    <html lang="ja" suppressHydrationWarning className="overflow-hidden">
      {/* suppressHydrationWarning={true} を追加することで、ブラウザ拡張機能（Grammarlyなど）が追加する属性によるハイドレーション警告を抑制します */}
      <body suppressHydrationWarning={true}>
        <SessionProvider session={session}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
