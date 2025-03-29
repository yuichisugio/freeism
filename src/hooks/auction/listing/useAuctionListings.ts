"use client";

import type { AuctionFilterParams, AuctionListingResult, AuctionSortOption } from "@/lib/auction/types";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/auction/bid/useDebounce";
import { getAuctionCategories, getAuctionListings, getAuctionPageSize } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";
import { DISPLAY } from "@/lib/auction/constants";

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings() {
  // Next.js関連
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // URLからパラメータを取得
  const currentPage = Number(searchParams.get("page") || "1");
  const currentCategory = searchParams.get("category") || "すべて";
  const currentStatus = (searchParams.get("status") || "all") as AuctionFilterParams["status"];
  const currentSort = (searchParams.get("sort") || "newest") as AuctionSortOption;
  const currentQuery = searchParams.get("q") || "";

  // カテゴリと表示件数
  const [categories, setCategories] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(DISPLAY.PAGE_SIZE);

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

  // フィルターリセットハンドラ
  const handleResetFilters = () => {
    setFilters({
      category: "すべて",
      status: "all",
      searchQuery: "",
    });
    setSearchQuery("");
    setSortOption("newest");
    setPage(1);
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

  return {
    // 状態
    isPending,
    categories,
    pageSize,
    auctions,
    totalCount,
    totalPages,
    userPoints,
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
  };
}
