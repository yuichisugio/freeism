"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getUserBidHistoriesWithCount, getUserCreatedAuctionsWithCount, getUserWonAuctionsWithCount } from "@/lib/auction/action/auction-history";
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
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

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
  const VALID_UI_FILTERS = ["pending", "active", "ended", "supplier_done", "creator", "executor", "reporter"] as const;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * nuqsでクエリパラメータを一括管理
   */
  const [params, setParams] = useQueryStates(
    {
      tab: parseAsString.withDefault("bids"),
      page: parseAsInteger.withDefault(1),
      itemPerPage: parseAsInteger.withDefault(AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE),
      filter: parseAsArrayOf(parseAsString).withDefault([]),
      condition: parseAsString.withDefault("and"),
      wonStatus: parseAsString.withDefault("all"),
    },
    { clearOnDefault: true, history: "push" },
  );
  const activeTab = useMemo(() => params.tab ?? "bids", [params.tab]);
  const currentPage = useMemo(() => params.page ?? 1, [params.page]);
  const itemPerPage = useMemo(() => params.itemPerPage ?? AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE, [params.itemPerPage]);
  const filter = useMemo(() => (params.filter ?? []) as AuctionCreatedTabFilter[], [params.filter]);
  const filterCondition = useMemo(() => (params.condition ?? "and") as FilterCondition, [params.condition]);
  const wonStatus = useMemo(() => params.wonStatus ?? "all", [params.wonStatus]);

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
   * 入札履歴を取得＋件数
   */
  const { data: bidHistoryResult, isPending: isLoadingBids } = useQuery<{ data: BidHistoryItem[]; count: number }>({
    queryKey: queryCacheKeys.auction.historyBids(userId!, currentPage, itemPerPage),
    queryFn: () => getUserBidHistoriesWithCount(currentPage, userId!, itemPerPage),
    enabled: !!userId && activeTab === "bids",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const bidHistoryData = useMemo(() => bidHistoryResult?.data ?? [], [bidHistoryResult]);
  const bidHistoryCount = useMemo(() => bidHistoryResult?.count ?? 0, [bidHistoryResult]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴を取得＋件数
   */
  const { data: wonHistoryResult, isPending: isLoadingWon } = useQuery<{ data: WonAuctionItem[]; count: number }>({
    queryKey: queryCacheKeys.auction.historyWon(userId!, currentPage, itemPerPage, wonStatus),
    queryFn: () => getUserWonAuctionsWithCount(currentPage, userId!, itemPerPage, wonStatus),
    enabled: !!userId && activeTab === "won",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const wonHistoryData = useMemo(() => wonHistoryResult?.data ?? [], [wonHistoryResult]);
  const wonAuctionsCount = useMemo(() => wonHistoryResult?.count ?? 0, [wonHistoryResult]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴を取得＋件数
   */
  const { data: createdHistoryResult, isPending: isLoadingCreated } = useQuery<{ data: CreatedAuctionItem[]; count: number }>({
    queryKey: queryCacheKeys.auction.historyCreated(userId!, currentPage, itemPerPage, filter, filterCondition),
    queryFn: () => getUserCreatedAuctionsWithCount(currentPage, userId!, itemPerPage, filter, filterCondition),
    enabled: !!userId && activeTab === "created",
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
  const createdHistoryData = useMemo(() => createdHistoryResult?.data ?? [], [createdHistoryResult]);
  const createdAuctionsCount = useMemo(() => createdHistoryResult?.count ?? 0, [createdHistoryResult]);

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
          getUserBidHistoriesWithCount,
          [userId, nextPage, itemPerPage] as [string, number, number],
          [nextPage, userId, itemPerPage] as [number, string, number],
        );
        break;
      case "won":
        void prefetchLogic(
          wonAuctionsCount,
          !!wonHistoryData && wonHistoryData.length > 0,
          queryCacheKeys.auction.historyWon,
          getUserWonAuctionsWithCount,
          [userId, nextPage, itemPerPage, wonStatus] as [string, number, number, string],
          [nextPage, userId, itemPerPage, wonStatus] as [number, string, number, string],
        );
        break;
      case "created":
        void prefetchLogic(
          createdAuctionsCount,
          !!createdHistoryData && createdHistoryData.length > 0,
          queryCacheKeys.auction.historyCreated,
          getUserCreatedAuctionsWithCount,
          [userId, nextPage, itemPerPage, filter, filterCondition] as [string, number, number, AuctionCreatedTabFilter[], FilterCondition],
          [nextPage, userId, itemPerPage, filter, filterCondition] as [number, string, number, AuctionCreatedTabFilter[], FilterCondition],
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
    wonStatus,
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
        return isLoadingBids;
      case "won":
        return isLoadingWon;
      case "created":
        return isLoadingCreated;
      default:
        return false;
    }
  }, [activeTab, isLoadingBids, isLoadingWon, isLoadingCreated, userId]);

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブの変更
   */
  const handleTabChange = useCallback(
    (value: string) => {
      if (value === "won") {
        // wonタブ: wonStatus以外の出品用パラメータを消す
        void setParams((prev) => {
          const { filter, condition, ...rest } = prev;
          return { ...rest, tab: value, page: 1, wonStatus: "all", filter: null, condition: null };
        });
      } else if (value === "created") {
        // createdタブ: wonStatusを消す
        void setParams((prev) => {
          const { wonStatus, ...rest } = prev;
          return { ...rest, tab: value, page: 1, wonStatus: null };
        });
      } else {
        // bidsタブ: wonStatus, filter, conditionを消す
        void setParams((prev) => {
          const { wonStatus, filter, condition, ...rest } = prev;
          return { ...rest, tab: value, page: 1, wonStatus: null, filter: null, condition: null };
        });
      }
    },
    [setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページの変更
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      void setParams((prev) => ({ ...prev, page: newPage }));
    },
    [setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページの変更
   */
  const handleItemPerPageChange = useCallback(
    (newItemPerPage: number) => {
      void setParams((prev) => ({ ...prev, itemPerPage: newItemPerPage, page: 1 }));
    },
    [setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターの変更
   */
  const handleFilterChange = useCallback(
    (newFilter: AuctionCreatedTabFilter[]) => {
      void setParams((prev) => ({ ...prev, filter: newFilter, page: 1 }));
    },
    [setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターの条件の変更
   */
  const handleFilterConditionChange = useCallback(
    (newCondition: FilterCondition) => {
      void setParams((prev) => ({ ...prev, condition: newCondition, page: 1 }));
    },
    [setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターのクリア
   */
  const handleClearFilters = useCallback(() => {
    void setParams((prev) => ({ ...prev, filter: [], page: 1 }));
  }, [setParams]);

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
    wonStatus,
    bidHistoryData,
    wonHistoryData,
    createdHistoryData,
    currentDataCount,
    isLoadingCurrentTab,
    userId,
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
    setParams,
  };
}
