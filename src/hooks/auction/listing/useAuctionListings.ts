"use client";

import type { AuctionFilterParams, AuctionSortOption } from "@/lib/auction/types";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/auction/bid/useDebounce";
import { getAuctionCategories, getAuctionListings, getAuctionPageSize } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";
import { AUCTION_CATEGORIES, DISPLAY } from "@/lib/auction/constants";

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 * @returns オークション一覧画面のロジック
 * @description オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // Next.js関連
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // URLからパラメータを取得
  const searchParams = useSearchParams();

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") || "1");

  // カテゴリのURLパラメータ
  const currentCategory = searchParams.get("category") || "すべて";

  // ステータスのURLパラメータ
  const currentStatus = (searchParams.get("status") || "all") as AuctionFilterParams["status"];

  // ソートのURLパラメータ
  const currentSort = (searchParams.get("sort") || "newest") as AuctionSortOption;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q") || "";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カテゴリと表示件数
  // カテゴリ - 直接定数からデフォルト値を設定
  const [categories, setCategories] = useState<string[]>(AUCTION_CATEGORIES);

  // 表示件数
  const [pageSize, setPageSize] = useState(DISPLAY.PAGE_SIZE);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ローカルステート
  // オークション情報
  const [auctions, setAuctions] = useState<any[]>([]);
  // 合計件数
  const [totalCount, setTotalCount] = useState(0);
  // 合計ページ数
  const [totalPages, setTotalPages] = useState(1);
  // ユーザーポイント
  const [userPoints, setUserPoints] = useState(0);
  // 検索クエリ
  const [searchQuery, setSearchQuery] = useState(currentQuery);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックから、デバンスした検索クエリを取得.特定のイベントが発生してから一定期間処理を待機し、その期間内に同じイベントが発生しなかった場合にのみ関数を実行する手法
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター状態
  const [filters, setFilters] = useState<AuctionFilterParams>({
    category: currentCategory,
    status: currentStatus,
    searchQuery: currentQuery,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ソート状態
  const [sortOption, setSortOption] = useState<AuctionSortOption>(currentSort);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ページネーション
  const [page, setPage] = useState(currentPage);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリストの変更を追跡
  const [watchlistChanges, setWatchlistChanges] = useState<Set<string>>(new Set());
  const saveWatchlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 初期設定データの取得
  useEffect(() => {
    async function loadInitialData() {
      try {
        const categoriesData = await getAuctionCategories();
        const pageSizeData = await getAuctionPageSize();

        console.log("Fetched categories:", categoriesData);

        if (categoriesData && Array.isArray(categoriesData) && categoriesData.length > 0) {
          setCategories(categoriesData);
        } else {
          console.error("Invalid categories data received:", categoriesData);
        }

        setPageSize(pageSizeData);
      } catch (error) {
        console.error("Error loading initial data:", error);
        // エラー時にはデフォルト値を使用（すでに設定済み）
      }
    }

    loadInitialData();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // URL変更と同時にデータ取得
  useEffect(() => {
    startTransition(() => {
      updateUrlParams();
      fetchListings();
    });
  }, [updateUrlParams, fetchListings]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 検索クエリ変更時
  useEffect(() => {
    if (debouncedSearchQuery !== filters.searchQuery) {
      setFilters((prev) => ({ ...prev, searchQuery: debouncedSearchQuery }));
      setPage(1); // 検索時は1ページ目に戻す
    }
  }, [debouncedSearchQuery, filters.searchQuery]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ページ変更ハンドラ
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター変更ハンドラ
  const handleFilterChange = useCallback((newFilters: Partial<AuctionFilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // フィルター変更時は1ページ目に戻す
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ソート変更ハンドラ
  const handleSortChange = useCallback((newSort: AuctionSortOption) => {
    setSortOption(newSort);
    setPage(1); // ソート変更時は1ページ目に戻す
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルターリセットハンドラ
  const handleResetFilters = useCallback(() => {
    setFilters({
      category: "すべて",
      status: "all",
      searchQuery: "",
    });
    setSearchQuery("");
    setSortOption("newest");
    setPage(1);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリスト切り替えハンドラ
  const handleToggleWatchlist = useCallback(
    async (auctionId: string) => {
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
    },
    [watchlistChanges],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 画面を離れる時に未保存の変更を保存
  useEffect(() => {
    return () => {
      // クリーンアップ関数：コンポーネントがアンマウントされる時に実行。そのためクリーンアップ部分に記載
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
