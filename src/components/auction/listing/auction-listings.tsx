"use client";

import React, { memo, useCallback } from "react";
import { AuctionCard } from "@/components/auction/listing/auction-card";
import { AuctionFilters } from "@/components/auction/listing/auction-filters";
import { AuctionPagination } from "@/components/auction/listing/auction-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuctionListings } from "@/hooks/auction/listing/use-auction-listings";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション商品一覧コンポーネント
 * @returns オークション商品一覧コンポーネント
 */
export const AuctionListings = memo(function AuctionListings() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックと状態を取得
  const {
    // 状態
    auctions,
    totalAuctionsCount,
    listingsConditions,
    isLoading,

    // アクション
    handleToggleWatchlist,
    setListingsConditions,
  } = useAuctionListings();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 商品が見つからない場合
  const noResults = useCallback(() => {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 text-center">
          <h3 className="text-xl font-medium text-gray-900">商品が見つかりませんでした</h3>
          <p className="mt-2 text-gray-500">検索条件を変更するか、別のフィルターを試してみてください。</p>
        </div>
      </div>
    );
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ローディング状態の場合
  const loading = useCallback(() => {
    return (
      <>
        {/* スケルトン */}
        <div className="space-y-4">
          <div className="flex animate-pulse items-center justify-center py-4">
            <div className="bg-primary mr-2 h-4 w-4 rounded-full"></div>
            <div className="bg-primary mr-2 h-4 w-4 rounded-full opacity-75 delay-150"></div>
            <div className="bg-primary h-4 w-4 rounded-full opacity-50 delay-300"></div>
            <span className="ml-3 text-gray-600">データを読み込み中...</span>
          </div>

          {/* 商品一覧 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg bg-white shadow-md">
                <Skeleton className="h-48 w-full" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ローディング状態の場合
  if (isLoading) {
    return loading();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="space-y-6">
      {/* フィルターコンポーネント */}
      <AuctionFilters listingsConditions={listingsConditions} setListingsConditionsAction={setListingsConditions} auctions={auctions} />

      {/* 結果表示 */}
      {auctions.length > 0 ? (
        <>
          {/* 商品一覧 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {auctions.map((auction) => {
              // AuctionCardPropsの型定義に合わせて変換
              const auctionForCard = {
                ...auction,
                description: auction.description ?? undefined,
                imageUrl: auction.imageUrl ?? undefined,
              };
              return <AuctionCard key={auction.id} auction={auctionForCard} onToggleWatchlistAction={handleToggleWatchlist} />;
            })}
          </div>

          {/* ページネーション */}
          <AuctionPagination
            listingsConditions={listingsConditions}
            setListingsConditionsAction={setListingsConditions}
            totalAuctionsCount={totalAuctionsCount}
          />
        </>
      ) : (
        noResults()
      )}
    </div>
  );
});
