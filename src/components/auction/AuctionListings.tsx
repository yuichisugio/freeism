"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/app/actions/auction";
import React, { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuctionCategories, getAuctionListings, getAuctionPageSize, toggleWatchlist } from "@/app/actions/auction";
import AuctionCard from "@/components/auction/AuctionCard";
import AuctionFilters from "@/components/auction/AuctionFilters";
import CustomPagination from "@/components/ui/CustomPagination";
import SearchBar from "@/components/ui/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";

export default function AuctionListings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // カテゴリと表示件数
  const [categories, setCategories] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(50);

  // URLからパラメータを取得
  const currentPage = Number(searchParams.get("page") || "1");
  const currentCategory = searchParams.get("category") || "すべて";
  const currentStatus = (searchParams.get("status") || "all") as AuctionFilterParams["status"];
  const currentSort = (searchParams.get("sort") || "newest") as AuctionSortOption;
  const currentQuery = searchParams.get("q") || "";

  // ローカルステート
  const [auctions, setAuctions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [userPoints, setUserPoints] = useState(0);
  const [searchQuery, setSearchQuery] = useState(currentQuery);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // フィルター状態
  const [filters, setFilters] = useState<AuctionFilterParams>({
    category: currentCategory,
    status: currentStatus,
    searchQuery: currentQuery,
  });

  // ソート状態
  const [sortOption, setSortOption] = useState<AuctionSortOption>(currentSort);

  // ページネーション
  const [page, setPage] = useState(currentPage);

  // 初期設定データの取得
  useEffect(() => {
    async function loadInitialData() {
      const categoriesData = await getAuctionCategories();
      const pageSizeData = await getAuctionPageSize();

      setCategories(categoriesData);
      setPageSize(pageSizeData);
    }

    loadInitialData();
  }, []);

  // データ取得関数
  const fetchListings = async () => {
    const result = await getAuctionListings({
      page,
      pageSize,
      filters,
      sort: sortOption,
    });

    setAuctions(result.items);
    setTotalCount(result.totalCount);
    setTotalPages(result.totalPages);
    setUserPoints(result.userTotalPoints);
  };

  // URLパラメータを更新する関数
  const updateUrlParams = () => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (filters.category && filters.category !== "すべて") params.set("category", filters.category);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (sortOption !== "newest") params.set("sort", sortOption);
    if (filters.searchQuery) params.set("q", filters.searchQuery);

    const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newUrl);
  };

  // URL変更と同時にデータ取得
  useEffect(() => {
    startTransition(() => {
      updateUrlParams();
      fetchListings();
    });
  }, [page, filters, sortOption]);

  // 検索クエリ変更時
  useEffect(() => {
    if (debouncedSearchQuery !== filters.searchQuery) {
      setFilters((prev) => ({ ...prev, searchQuery: debouncedSearchQuery }));
      setPage(1); // 検索時は1ページ目に戻す
    }
  }, [debouncedSearchQuery]);

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // フィルター変更ハンドラ
  const handleFilterChange = (newFilters: Partial<AuctionFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // フィルター変更時は1ページ目に戻す
  };

  // ソート変更ハンドラ
  const handleSortChange = (newSort: AuctionSortOption) => {
    setSortOption(newSort);
    setPage(1); // ソート変更時は1ページ目に戻す
  };

  // ウォッチリスト切り替えハンドラ
  const handleToggleWatchlist = async (auctionId: string) => {
    try {
      const result = await toggleWatchlist(auctionId);

      // 楽観的UI更新
      setAuctions((prev) => prev.map((auction) => (auction.id === auctionId ? { ...auction, isWatched: result.isWatched } : auction)));
    } catch (error) {
      console.error("ウォッチリストの更新に失敗しました", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* ユーザーの総ポイント表示 */}
      <div className="mb-4 flex justify-end">
        <div className="rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-white shadow">
          <span className="font-bold">保有ポイント総額:</span> {userPoints.toLocaleString()} ポイント
        </div>
      </div>

      {/* カテゴリタブ */}
      <div className="mb-4 flex overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            className={`mx-1 rounded-full px-4 py-2 whitespace-nowrap ${filters.category === category ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            onClick={() => handleFilterChange({ category })}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 検索バーとフィルター */}
      <div className="flex flex-col items-start gap-4 md:flex-row">
        <div className="w-full md:w-1/3">
          <SearchBar placeholder="商品名や説明文を検索..." value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} />
        </div>

        <div className="w-full md:w-2/3">
          <AuctionFilters filters={filters} onFilterChangeAction={handleFilterChange} sortOption={sortOption} onSortChangeAction={handleSortChange} />
        </div>
      </div>

      {/* 商品一覧 */}
      {isPending ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
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
      ) : (
        <>
          {auctions.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} onToggleWatchlistAction={handleToggleWatchlist} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-lg text-gray-500">条件に一致するオークション商品が見つかりませんでした</p>
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <CustomPagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
            </div>
          )}
        </>
      )}

      {/* 総件数表示 */}
      <div className="text-right text-sm text-gray-500">
        全 {totalCount.toLocaleString()} 件中 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} 件を表示
      </div>
    </div>
  );
}
