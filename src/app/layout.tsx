import type { Metadata } from "next";

import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Freeism-app",
  description: "Freeism-app by sugio",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
