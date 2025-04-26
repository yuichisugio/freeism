"use client";

import type { AuctionWithDetails } from "@/lib/auction/type/types";
import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エラー表示コンポーネント
 */
const ErrorDisplay = memo(() => (
  <div className="rounded-lg bg-red-50 p-8 text-center">
    <h2 className="mb-2 text-lg font-semibold text-red-600">エラーが発生しました</h2>
    <p className="text-red-500">オークション情報の読み込みに失敗しました。</p>
    <p className="mt-2 text-sm text-gray-500">しばらく経ってから再度お試しください。</p>
  </div>
));
ErrorDisplay.displayName = "ErrorDisplay";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ローディング表示コンポーネント
 */
const LoadingDisplay = memo(() => (
  <div className="p-8 text-center">
    <div className="animate-pulse">
      <div className="mx-auto mb-4 h-4 w-3/4 rounded bg-gray-200"></div>
      <div className="mx-auto h-4 w-1/2 rounded bg-gray-200"></div>
    </div>
    <p className="mt-4 text-gray-500">オークション情報を読み込み中...</p>
  </div>
));
LoadingDisplay.displayName = "LoadingDisplay";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 動的インポートされたコンポーネント
 */
const AuctionDetailClient = dynamic(() => import("@/components/auction/bid/auction-detail").then((mod) => ({ default: mod.AuctionDetail })), {
  ssr: false,
  loading: () => <LoadingDisplay />,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション詳細ページのクライアントコンポーネント
 * @param props コンポーネントのプロパティ
 * @returns オークション詳細ページ
 */
// eslint-disable-next-line import/no-default-export
export default function AuctionDetailWrapper({ initialAuction }: { initialAuction: AuctionWithDetails }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // 初期データが不正な場合はエラー状態にする
    if (!initialAuction?.id || !initialAuction?.task) {
      console.error("オークション詳細の初期データが不正です", initialAuction);
      setHasError(true);
    }
  }, [initialAuction]);

  // エラーの場合はエラー表示
  if (hasError) {
    return <ErrorDisplay />;
  }

  return <AuctionDetailClient initialAuction={initialAuction} />;
}
