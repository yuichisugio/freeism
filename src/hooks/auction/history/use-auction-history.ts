"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getUserBidHistories,
  getUserBidHistoryCount,
  getUserCreatedAuctions,
  getUserCreatedAuctionsCount,
  getUserWonAuctions,
  getUserWonAuctionsCount,
} from "@/lib/auction/action/auction-history";
import { AUCTION_HISTORY_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import {
  type AuctionCreatedTabFilter,
  type BidHistoryItem,
  type CreatedAuctionItem,
  type FilterCondition,
  type WonAuctionItem,
} from "@/types/auction-types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useQueryState } from "nuqs";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札・落札履歴のカスタムフック
 * @returns 入札・落札履歴のカスタムフック
 */
export function useAuctionHistory() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * UIで表示するフィルターの定義 ("all" を除く)
   */
  const VALID_UI_FILTERS = ["active", "ended", "pending", "creator", "executor", "reporter", "supplier_done"] as const;

  // nuqsでクエリパラメータを管理
  const [activeTab = "bids", setActiveTab] = useQueryState("tab", { defaultValue: "bids", history: "push" });
  const [currentPage = 1, setCurrentPage] = useQueryState("page", { defaultValue: 1, history: "push", parse: Number, serialize: String });
  const [itemPerPage = AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE, setItemPerPage] = useQueryState("itemPerPage", {
    defaultValue: AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE,
    history: "push",
    parse: Number,
    serialize: String,
  });
  const [filterRaw = [], setFilterRaw] = useQueryState("filter", {
    defaultValue: [],
    history: "push",
    parse: (v) => (v ? v.split(",") : []),
    serialize: (v) => v.join(","),
  });
  const [filterConditionRaw = "or", setFilterConditionRaw] = useQueryState("condition", { defaultValue: "or", history: "push" });
  const filter = filterRaw as AuctionCreatedTabFilter[];
  const setFilter = setFilterRaw as (v: AuctionCreatedTabFilter[]) => void;
  const filterCondition = filterConditionRaw as FilterCondition;
  const setFilterCondition = setFilterConditionRaw as (v: FilterCondition) => void;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 検索パラメータ
   */
  const searchParams = useSearchParams();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札履歴を取得
   */
  const { data: bidHistoryData, isPending: isLoadingBids } = useQuery<BidHistoryItem[]>({
    queryKey: queryCacheKeys.auction.historyBids(userId!, currentPage, itemPerPage),
    queryFn: () => getUserBidHistories(currentPage, userId!, itemPerPage),
    enabled: !!userId && activeTab === "bids",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札履歴の件数を取得
   */
  const { data: bidHistoryCount, isPending: isLoadingBidHistoryCount } = useQuery<number>({
    queryKey: queryCacheKeys.auction.historyBidsCount(userId!),
    queryFn: () => getUserBidHistoryCount(userId!),
    enabled: !!userId && activeTab === "bids",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴を取得
   */
  const { data: wonHistoryData, isPending: isLoadingWon } = useQuery<WonAuctionItem[]>({
    queryKey: queryCacheKeys.auction.historyWon(userId!, currentPage, itemPerPage),
    queryFn: () => getUserWonAuctions(currentPage, userId!, itemPerPage),
    enabled: !!userId && activeTab === "won",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴の件数を取得
   */
  const { data: wonAuctionsCount, isPending: isLoadingWonCount } = useQuery<number>({
    queryKey: queryCacheKeys.auction.historyWonCount(userId!),
    queryFn: () => getUserWonAuctionsCount(userId!),
    enabled: !!userId && activeTab === "won",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴を取得
   */
  const { data: createdHistoryData, isPending: isLoadingCreated } = useQuery<CreatedAuctionItem[]>({
    queryKey: queryCacheKeys.auction.historyCreated(userId!, currentPage, itemPerPage, filter, filterCondition),
    queryFn: () => getUserCreatedAuctions(currentPage, userId!, itemPerPage, filter, filterCondition),
    enabled: !!userId && activeTab === "created",
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴の件数を取得
   */
  const { data: createdAuctionsCount, isPending: isLoadingCreatedCount } = useQuery<number>({
    queryKey: queryCacheKeys.auction.historyCreatedCount(userId!, filter, filterCondition),
    queryFn: () => getUserCreatedAuctionsCount(userId!, filter, filterCondition),
    enabled: !!userId && activeTab === "created",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 次のページのデータを prefetch する
   */
  useEffect(() => {
    if (!userId) return;

    const prefetchLogic = async <TQueryKey extends readonly unknown[], TData, TQueryKeyFnArgs extends unknown[], TFetchFnArgs extends unknown[]>(
      count: number | undefined,
      dataExists: boolean,
      queryKeyFn: (...args: TQueryKeyFnArgs) => TQueryKey,
      fetchFn: (...args: TFetchFnArgs) => Promise<TData>,
      queryKeyArgs: TQueryKeyFnArgs,
      fetchFnArgs: TFetchFnArgs,
    ) => {
      if (dataExists && count !== undefined) {
        const totalPages = Math.ceil(count / itemPerPage);
        if (currentPage < totalPages) {
          await queryClient.prefetchQuery({
            queryKey: queryKeyFn(...queryKeyArgs),
            queryFn: () => fetchFn(...fetchFnArgs),
          });
        }
      }
    };

    const nextPage = currentPage + 1;

    switch (activeTab) {
      case "bids":
        void prefetchLogic(
          bidHistoryCount,
          !!bidHistoryData && bidHistoryData.length > 0,
          queryCacheKeys.auction.historyBids,
          getUserBidHistories,
          [userId, nextPage, itemPerPage] as [string, number, number], // queryKeyArgs for historyBids
          [nextPage, userId, itemPerPage] as [number, string, number], // fetchFnArgs for getUserBidHistories
        );
        break;
      case "won":
        void prefetchLogic(
          wonAuctionsCount,
          !!wonHistoryData && wonHistoryData.length > 0,
          queryCacheKeys.auction.historyWon,
          getUserWonAuctions,
          [userId, nextPage, itemPerPage] as [string, number, number], // queryKeyArgs for historyWon
          [nextPage, userId, itemPerPage] as [number, string, number], // fetchFnArgs for getUserWonAuctions
        );
        break;
      case "created":
        void prefetchLogic(
          createdAuctionsCount,
          !!createdHistoryData && createdHistoryData.length > 0,
          queryCacheKeys.auction.historyCreated,
          getUserCreatedAuctions,
          [userId, nextPage, itemPerPage, filter, filterCondition] as [string, number, number, AuctionCreatedTabFilter[], FilterCondition], // queryKeyArgs for historyCreated
          [nextPage, userId, itemPerPage, filter, filterCondition] as [number, string, number, AuctionCreatedTabFilter[], FilterCondition], // fetchFnArgs for getUserCreatedAuctions
        );
        break;
      default:
        break;
    }
  }, [
    activeTab,
    currentPage,
    itemPerPage,
    userId,
    queryClient,
    bidHistoryData,
    bidHistoryCount,
    wonHistoryData,
    wonAuctionsCount,
    createdHistoryData,
    createdAuctionsCount,
    filter,
    filterCondition,
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在のデータの件数を取得
   */
  const currentDataCount = useMemo(() => {
    switch (activeTab) {
      case "bids":
        return bidHistoryCount ?? 0;
      case "won":
        return wonAuctionsCount ?? 0;
      case "created":
        return createdAuctionsCount ?? 0;
      default:
        return 0;
    }
  }, [activeTab, bidHistoryCount, wonAuctionsCount, createdAuctionsCount]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Loadin中の表示条件
   */
  const isLoadingCurrentTab = useMemo(() => {
    if (!userId) return false;
    switch (activeTab) {
      case "bids":
        return isLoadingBids || isLoadingBidHistoryCount;
      case "won":
        return isLoadingWon || isLoadingWonCount;
      case "created":
        return isLoadingCreated || isLoadingCreatedCount;
      default:
        return false;
    }
  }, [activeTab, isLoadingBids, isLoadingBidHistoryCount, isLoadingWon, isLoadingWonCount, isLoadingCreated, isLoadingCreatedCount, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ナビゲーションを設定
   */
  const navigateToDetail = useCallback((path: string) => router.push(path), [router]);
  const handleItemClick = useCallback((auctionId: string) => navigateToDetail(`/dashboard/auction/${auctionId}`), [navigateToDetail]);
  const handleWonItemClick = useCallback((auctionId: string) => navigateToDetail(`/dashboard/auction/won-detail/${auctionId}`), [navigateToDetail]);
  const handleCreatedItemClick = useCallback(
    (auctionId: string) => navigateToDetail(`/dashboard/auction/created-detail/${auctionId}`),
    [navigateToDetail],
  );

  // ハンドラ関数
  const handleTabChange = useCallback(
    (value: string) => {
      void setActiveTab(value);
      void setCurrentPage(1);
    },
    [setActiveTab, setCurrentPage],
  );
  const handlePageChange = useCallback(
    (newPage: number) => {
      void setCurrentPage(newPage);
    },
    [setCurrentPage],
  );
  const handleItemPerPageChange = useCallback(
    (newItemPerPage: number) => {
      void setItemPerPage(newItemPerPage);
      void setCurrentPage(1);
    },
    [setItemPerPage, setCurrentPage],
  );
  const handleFilterChange = useCallback(
    (newFilter: AuctionCreatedTabFilter[]) => {
      void setFilter(newFilter);
      void setCurrentPage(1);
    },
    [setFilter, setCurrentPage],
  );
  const handleFilterConditionChange = useCallback(
    (newCondition: FilterCondition) => {
      void setFilterCondition(newCondition);
      void setCurrentPage(1);
    },
    [setFilterCondition, setCurrentPage],
  );
  const handleClearFilters = useCallback(() => {
    void setFilter([]);
    void setCurrentPage(1);
  }, [setFilter, setCurrentPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札・落札履歴のカスタムフックの返却
   */
  return {
    // state
    activeTab,
    currentPage,
    itemPerPage,
    filter,
    filterCondition,
    bidHistoryData: bidHistoryData ?? [],
    wonHistoryData: wonHistoryData ?? [],
    createdHistoryData: createdHistoryData ?? [],
    currentDataCount,
    isLoadingCurrentTab,
    userId,
    searchParams,
    VALID_UI_FILTERS,
    // function
    handleItemClick,
    handleWonItemClick,
    handleCreatedItemClick,
    handleTabChange,
    handlePageChange,
    handleItemPerPageChange,
    handleFilterChange,
    handleClearFilters,
    handleFilterConditionChange,
  };
}
