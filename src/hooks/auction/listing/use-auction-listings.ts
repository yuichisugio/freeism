"use client";

import type { AuctionFilterParams, AuctionListingResult, AuctionSortOption } from "@/lib/auction/type/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/auction/bid/use-debounce";
import { useAuctionFilters } from "@/hooks/auction/listing/use-auction-filters";
import { getAuctionListings } from "@/lib/auction/action/auction-listing";
import { toggleWatchlist } from "@/lib/auction/action/watchlist";
import { AUCTION_CONSTANTS } from "@/lib/auction/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type UseAuctionListingsReturn = {
  pageSize: number;
  auctions: AuctionListingResult["items"];
  totalCount: number;
  totalPages: number;
  searchQuery: string;
  filters: AuctionFilterParams;
  sortOption: AuctionSortOption;
  page: number;
  userPoints: number;
  isPending: boolean;
  setSearchQuery: (query: string) => void;
  handlePageChange: (newPage: number) => void;
  handleFilterChange: (newFilters: Partial<AuctionFilterParams>) => void;
  handleSortChange: (newSort: AuctionSortOption) => void;
  handleResetFilters: () => void;
  handleToggleWatchlist: (auctionId: string) => Promise<void>;
};

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 * @returns オークション一覧画面のロジック
 * @description オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings(): UseAuctionListingsReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // URLからパラメータを取得
  const searchParams = useSearchParams();

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") ?? "1");

  // カテゴリのURLパラメータ
  const currentCategory = searchParams.get("category") ?? "すべて";

  // ステータスのURLパラメータ
  const currentStatus = (searchParams.get("status") ?? "all") as AuctionFilterParams["status"];

  // ソートのURLパラメータ
  const currentSort = (searchParams.get("sort") ?? "newest") as AuctionSortOption;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q") ?? "";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 表示件数
  const [pageSize] = useState(AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークション情報
  const [auctions, setAuctions] = useState<AuctionListingResult["items"]>([]);
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

  // データ読み込み中の状態
  const [isPending, setIsPending] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルターカスタムフックから追加のロジックを取得
  const {
    handleFilterChange: filterChangeWithUrl,
    handleSortChange: sortChangeWithUrl,
    handleResetAllFilters,
    updateUrlParams,
  } = useAuctionFilters({
    filters,
    onFilterChangeAction: (newFilters) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
    },
    sortOption,
    onSortChangeAction: setSortOption,
    onResetFilters: () => {
      setFilters({
        category: "すべて",
        status: "all",
        searchQuery: "",
      });
      setSearchQuery("");
      setSortOption("newest");
      setPage(1);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データを取得する関数
   * @returns Promise<void>
   */
  const getAuctionListingsData = useCallback(async () => {
    try {
      // ーーーーーーーーーーーーーーー

      // データ取得中の状態
      setIsPending(true);

      // ーーーーーーーーーーーーーーー

      // オークション一覧データを取得
      const result = await getAuctionListings({ page, pageSize, filters, sort: sortOption });

      // ーーーーーーーーーーーーーーー

      // 結果の設定
      setAuctions(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setUserPoints(result.userTotalPoints);

      // ーーーーーーーーーーーーーーー

      // 成功ログ
      console.log("use-auction-listings_fetchListings_success", { totalCount: result.totalCount, totalPages: result.totalPages, itemsCount: result.items.length });

      // ーーーーーーーーーーーーーーー
    } catch (error) {
      // エラーログ
      console.error("use-auction-listings_fetchListings_error", error);

      // ーーーーーーーーーーーーーーー
    } finally {
      // データ取得中の状態を解除
      setIsPending(false);
    }
  }, [page, pageSize, filters, sortOption]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 初期設定データの取得と初回データ読み込み
   */
  useEffect(() => {
    // マウント時に1回だけ実行
    const initializeData = async () => {
      setIsPending(true);
      await getAuctionListingsData();
      setIsPending(false);
    };

    void initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回レンダリング時のみ実行（無限ループ防止）

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索クエリ変更時
   * @param debouncedSearchQuery デバンスした検索クエリ
   * @param filters.searchQuery フィルターの検索クエリ
   * @param fetchDataAndUpdateUrl データ取得とURL更新
   */
  useEffect(() => {
    if (debouncedSearchQuery !== filters.searchQuery) {
      filterChangeWithUrl({ searchQuery: debouncedSearchQuery });
      void getAuctionListingsData();
    }
  }, [debouncedSearchQuery, filters.searchQuery, filterChangeWithUrl, getAuctionListingsData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページ変更ハンドラ
   * @param newPage 新しいページ
   * @returns Promise<void>
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      // URLパラメータを更新
      updateUrlParams();
      // ページ変更時にデータ取得
      void getAuctionListingsData();
    },
    [getAuctionListingsData, updateUrlParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター変更ハンドラ
   * @param newFilters 新しいフィルター
   * @returns Promise<void>
   */
  const handleFilterChange = useCallback(
    (newFilters: Partial<AuctionFilterParams>) => {
      // フィルターカスタムフックのハンドラを呼び出し、URL更新も行う
      filterChangeWithUrl(newFilters);
      void getAuctionListingsData();
    },
    [filterChangeWithUrl, getAuctionListingsData],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ソート変更ハンドラ
   * @param newSort 新しいソートオプション
   * @returns Promise<void>
   */
  const handleSortChange = useCallback(
    (newSort: AuctionSortOption) => {
      // ソートカスタムフックのハンドラを呼び出し、URL更新も行う
      sortChangeWithUrl(newSort);
      void getAuctionListingsData();
    },
    [sortChangeWithUrl, getAuctionListingsData],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターリセットハンドラ
   * @returns Promise<void>
   */
  const handleResetFilters = useCallback(() => {
    handleResetAllFilters();
    void getAuctionListingsData();
  }, [handleResetAllFilters, getAuctionListingsData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリスト
   * ウォッチリスト切り替えハンドラ
   * @param auctionId オークションID
   * @returns Promise<void>
   */
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
        saveWatchlistTimeoutRef.current = setTimeout(
          () => {
            if (watchlistChanges.size > 0) {
              // 各変更を処理
              const changes = Array.from(watchlistChanges);
              for (const id of changes) {
                void toggleWatchlist(id).catch((error) => {
                  console.error("ウォッチリストの更新に失敗しました", error);
                });
              }
              // 変更リストをクリア
              setWatchlistChanges(new Set());
            }
          },
          1000 * 60 * 10,
        );
      } catch (error) {
        console.error("ウォッチリストの更新に失敗しました", error);
      }
    },
    [watchlistChanges],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリスト
   * 画面を離れる時に未保存のウォッチリストの変更を保存
   */
  useEffect(() => {
    return () => {
      // クリーンアップ関数：コンポーネントがアンマウントされる時に実行。そのためクリーンアップ部分に記載
      const saveRemainingChanges = async () => {
        if (watchlistChanges.size > 0) {
          const changes = Array.from(watchlistChanges);
          for (const id of changes) {
            void toggleWatchlist(id).catch((error) => {
              console.error("クリーンアップ時のウォッチリスト更新に失敗しました", error);
            });
          }
        }
      };

      if (saveWatchlistTimeoutRef.current) {
        clearTimeout(saveWatchlistTimeoutRef.current);
      }

      void saveRemainingChanges();
    };
  }, [watchlistChanges]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    pageSize,
    auctions,
    totalCount,
    totalPages,
    searchQuery,
    filters,
    sortOption,
    page,
    userPoints,
    isPending,
    setSearchQuery,
    handlePageChange,
    handleFilterChange,
    handleSortChange,
    handleResetFilters,
    handleToggleWatchlist,
  };
}
