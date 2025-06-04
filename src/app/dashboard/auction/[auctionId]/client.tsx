"use client";

import { memo, Suspense } from "react";
import dynamic from "next/dynamic";
import { NoResult } from "@/components/share/share-no-result";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useQuery } from "@tanstack/react-query";

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
 * Hydrationエラーを回避するため、loadingプロパティは使用せずSuspenseで包む
 */
const AuctionDetailClient = dynamic(() => import("@/components/auction/bid/auction-bid-detail").then((mod) => ({ default: mod.AuctionBidDetail })), {
  ssr: false,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション詳細ページのクライアントコンポーネント
 * @param props コンポーネントのプロパティ
 * @returns オークション詳細ページ
 */
// eslint-disable-next-line import/no-default-export
export default function AuctionDetailWrapper({ auctionId }: { auctionId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションデータを取得
   */
  const { data: initialAuction, isPending } = useQuery({
    queryKey: queryCacheKeys.auction.detail(auctionId),
    queryFn: () => getAuctionByAuctionId(auctionId),
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!auctionId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中はローディングコンポーネントを表示
   */
  if (isPending) {
    return <LoadingDisplay />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションデータが存在しない場合は404エラーを返す
   */
  if (!initialAuction) {
    console.log("src/app/dashboard/auction/[auctionId]/page.tsx_stack", new Error().stack);
    return <NoResult message="オークションが見つかりません" />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/app/dashboard/auction/[auctionId]/page.tsx_getAuctionByAuctionId_auctionData_success");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Suspense fallback={<LoadingDisplay />}>
      <AuctionDetailClient initialAuction={initialAuction} />
    </Suspense>
  );
}
