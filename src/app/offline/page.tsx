"use cache";

import { memo } from "react";
import { type Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";

// --------------------------------------------------

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "オフライン - Freeism-App",
  description: "インターネット接続を確認して再度お試しください。",
};

// --------------------------------------------------

/**
 * オフラインページ
 */
export default memo(async function OfflinePage() {
  cacheLife("max");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-4 text-2xl font-bold">オフラインです</h1>
      <p>インターネット接続を確認して再度お試しください。</p>
    </div>
  );
});
