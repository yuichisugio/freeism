"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/lib/auction/types";
import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuctionCard from "@/components/auction/listing/AuctionCard";
import AuctionFilters from "@/components/auction/listing/AuctionFilters";
import CustomPagination from "@/components/ui/CustomPagination";
import SearchBar from "@/components/ui/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/auction/useDebounce";
import { getAuctionCategories, getAuctionListings, getAuctionPageSize } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";
import { DISPLAY } from "@/lib/auction/constants";

// オークション商品一覧
export default function AuctionListings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // カテゴリと表示件数
  const [categories, setCategories] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(DISPLAY.PAGE_SIZE);

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

  // ウォッチリストの変更を追跡
  const [watchlistChanges, setWatchlistChanges] = useState<Set<string>>(new Set());
  const saveWatchlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const fetchListings = useCallback(async () => {
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
  }, [page, pageSize, filters, sortOption]);

  // URLパラメータを更新する関数
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (filters.category && filters.category !== "すべて") params.set("category", filters.category);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    if (sortOption !== "newest") params.set("sort", sortOption);
    if (filters.searchQuery) params.set("q", filters.searchQuery);

    const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(newUrl);
  }, [page, filters, sortOption, router]);

  // URL変更と同時にデータ取得
  useEffect(() => {
    startTransition(() => {
      updateUrlParams();
      fetchListings();
    });
  }, [updateUrlParams, fetchListings]);

  // 検索クエリ変更時
  useEffect(() => {
    if (debouncedSearchQuery !== filters.searchQuery) {
      setFilters((prev) => ({ ...prev, searchQuery: debouncedSearchQuery }));
      setPage(1); // 検索時は1ページ目に戻す
    }
  }, [debouncedSearchQuery, filters.searchQuery]);

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
      // 楽観的UI更新
      setAuctions((prev) => prev.map((auction) => (auction.id === auctionId ? { ...auction, isWatched: !auction.isWatched } : auction)));

      // 変更を追跡
      setWatchlistChanges((prev) => {
        const newChanges = new Set(prev);
        if (newChanges.has(auctionId)) {
          newChanges.delete(auctionId);
        } else {
          newChanges.add(auctionId);
        }
        return newChanges;
      });

      // 既存のタイマーをクリア
      if (saveWatchlistTimeoutRef.current) {
        clearTimeout(saveWatchlistTimeoutRef.current);
      }

      // 一定時間後に一括保存
      saveWatchlistTimeoutRef.current = setTimeout(() => {
        if (watchlistChanges.size > 0) {
          // 各変更を処理
          const changes = Array.from(watchlistChanges);
          for (const id of changes) {
            toggleWatchlist(id).catch((error) => {
              console.error("ウォッチリストの更新に失敗しました", error);
            });
          }
          // 変更リストをクリア
          setWatchlistChanges(new Set());
        }
      }, 2000);
    } catch (error) {
      console.error("ウォッチリストの更新に失敗しました", error);
    }
  };

  // 画面を離れる時に未保存の変更を保存
  useEffect(() => {
    return () => {
      // クリーンアップ関数：コンポーネントがアンマウントされる時に実行
      const saveRemainingChanges = async () => {
        if (watchlistChanges.size > 0) {
          const changes = Array.from(watchlistChanges);
          for (const id of changes) {
            await toggleWatchlist(id);
          }
        }
      };

      if (saveWatchlistTimeoutRef.current) {
        clearTimeout(saveWatchlistTimeoutRef.current);
      }

      saveRemainingChanges();
    };
  }, [watchlistChanges]);

  return (
    <div className="space-y-6">
      {/* ユーザーの総ポイント表示 */}
      <div className="mb-4 flex justify-end">
        <div className="rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-white shadow-sm">
          <span className="font-bold">保有ポイント総額:</span> {userPoints.toLocaleString()} ポイント
        </div>
      </div>

      {/* カテゴリタブ */}
      <div className="relative -mx-2 mb-4 sm:mx-0">
        <div className="scrollbar-hide flex overflow-x-auto pb-2 sm:pb-0">
          <div className="flex items-center space-x-1 px-2 sm:space-x-2">
            {categories.map((category) => (
              <button
                key={category}
                className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap sm:px-4 sm:py-2 ${
                  filters.category === category ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => handleFilterChange({ category })}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* スクロールフェードの装飾 - 横スクロールのUIヒントになります */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-white to-transparent sm:hidden"></div>
      </div>

      {/* 検索バーとフィルター */}
      <div className="flex flex-col items-start gap-4 md:flex-row">
        <div className="w-full md:w-1/3">
          <SearchBar placeholder="商品名や説明文を検索..." value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} />
        </div>

        <div className="w-full md:w-2/3">
          <AuctionFilters
            filters={filters}
            onFilterChangeAction={handleFilterChange}
            sortOption={sortOption}
            onSortChangeAction={handleSortChange}
            categories={categories}
            onResetFilters={() => {
              setFilters({
                category: "すべて",
                status: "all",
                searchQuery: "",
              });
              setSearchQuery("");
              setSortOption("newest");
              setPage(1);
            }}
          />
        </div>
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
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} onToggleWatchlistAction={handleToggleWatchlist} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-center">
                <h3 className="text-xl font-medium text-gray-900">商品が見つかりませんでした</h3>
                <p className="mt-2 text-gray-500">検索条件を変更するか、別のフィルターを試してみてください。</p>
              </div>
              <button
                onClick={() => {
                  setFilters({
                    category: "すべて",
                    status: "all",
                    searchQuery: "",
                  });
                  setSearchQuery("");
                  setSortOption("newest");
                  setPage(1);
                }}
                className="bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-white transition-colors"
              >
                フィルターをリセット
              </button>
            </div>
          )}

          {/* ページネーション */}
          {auctions.length > 0 && totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <CustomPagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} showPageInfo={true} />
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
