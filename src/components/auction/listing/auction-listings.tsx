"use client";

import React, { useEffect } from "react";
import { AuctionCard } from "@/components/auction/listing/auction-card";
import { AuctionFilters } from "@/components/auction/listing/auction-filters";
import { AuctionPagination } from "@/components/auction/listing/auction-pagination";
import SearchBar from "@/components/ui/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuctionListings } from "@/hooks/auction/listing/use-auction-listings";

/**
 * オークション商品一覧コンポーネント
 * @returns オークション商品一覧コンポーネント
 */
export function AuctionListings() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックからロジックと状態を取得
  const {
    // 状態
    isPending,
    categories,
    pageSize,
    auctions,
    totalCount,
    totalPages,
    searchQuery,
    filters,
    sortOption,
    page,

    // アクション
    setSearchQuery,
    handlePageChange,
    handleFilterChange,
    handleSortChange,
    handleResetFilters,
    handleToggleWatchlist,
  } = useAuctionListings();

  // デバッグ用: カテゴリの状態を確認
  useEffect(() => {
    console.log("Categories in component:", categories);
    console.log("Categories type:", typeof categories);
    console.log("Categories is Array:", Array.isArray(categories));
    console.log("Categories length:", categories ? categories.length : "undefined");
  }, [categories]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="space-y-6">
      {/* 検索バー */}
      <div className="w-full">
        <SearchBar placeholder="商品名や説明文を検索..." value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} />
      </div>

      {/* カテゴリタブ */}
      <div className="relative mx-2 mb-4 sm:mx-0">
        <div className="scrollbar-hide flex overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center justify-start space-x-1 sm:space-x-2">
            {categories && categories.length > 0 ? (
              categories.map((category: string) => (
                <button
                  key={category}
                  className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap sm:px-4 sm:py-2 ${filters.category === category ? "bg-primary bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  onClick={() => handleFilterChange({ category })}
                >
                  {category}
                </button>
              ))
            ) : (
              <div className="text-red-500">カテゴリが読み込まれていません ({categories ? categories.length : "undefined"})</div>
            )}
          </div>
        </div>

        {/* スクロールフェードの装飾 - 横スクロールのUIヒントになります */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white to-transparent sm:hidden"></div>
      </div>

      {/* フィルター */}
      <div className="w-full">
        <AuctionFilters filters={filters} onFilterChangeAction={handleFilterChange} sortOption={sortOption} onSortChangeAction={handleSortChange} categories={categories} onResetFilters={handleResetFilters} />
      </div>

      {/* ローディング状態または結果表示 */}
      {isPending ? (
        <div className="space-y-4">
          <div className="flex animate-pulse items-center justify-center py-4">
            <div className="bg-primary mr-2 h-4 w-4 rounded-full"></div>
            <div className="bg-primary mr-2 h-4 w-4 rounded-full opacity-75 delay-150"></div>
            <div className="bg-primary h-4 w-4 rounded-full opacity-50 delay-300"></div>
            <span className="ml-3 text-gray-600">データを読み込み中...</span>
          </div>
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
      ) : (
        <>
          {auctions.length > 0 ? (
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
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-center">
                <h3 className="text-xl font-medium text-gray-900">商品が見つかりませんでした</h3>
                <p className="mt-2 text-gray-500">検索条件を変更するか、別のフィルターを試してみてください。</p>
              </div>
              <button onClick={handleResetFilters} className="bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-white transition-colors">
                フィルターをリセット
              </button>
            </div>
          )}

          {/* ページネーション */}
          {auctions.length > 0 && totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <AuctionPagination currentPage={page} totalPages={totalPages} onPageChangeAction={handlePageChange} showPageInfo={true} />
            </div>
          )}

          {/* 商品数と合計ページ数の表示 */}
          {auctions.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              全{totalCount}件中 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)}件を表示
            </div>
          )}
        </>
      )}
    </div>
  );
}
