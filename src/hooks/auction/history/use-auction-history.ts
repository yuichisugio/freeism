"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getUserBidHistories, getUserBidHistoriesCount } from "@/lib/auction/action/auction-history/bid-auction";
import {
  getUserCreatedAuctions,
  getUserCreatedAuctionsCount,
} from "@/lib/auction/action/auction-history/created-auction";
import { getUserWonAuctions, getUserWonAuctionsCount } from "@/lib/auction/action/auction-history/won-auction";
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
  const itemPerPage = useMemo(
    () => params.itemPerPage ?? AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE,
    [params.itemPerPage],
  );
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
   * 入札したオークションの履歴を取得
   */
  const { data: bidHistoryResult, isPending: isLoadingBidHistories } = useQuery<BidHistoryItem[]>({
    queryKey: queryCacheKeys.auction.historyBids(userId!, currentPage, itemPerPage),
    queryFn: () => getUserBidHistories(currentPage, userId!, itemPerPage),
    enabled: !!userId && activeTab === "bids",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札したオークションの件数を取得
   * 件数とデータを別々に取得することで、ページを跨ぐごとに件数を取得しないので、サーバー負荷を少なくする
   */
  const { data: bidHistoryCount, isPending: isLoadingBidHistoriesCount } = useQuery<number>({
    queryKey: queryCacheKeys.auction.historyBidsCount(userId!),
    queryFn: () => getUserBidHistoriesCount(userId!),
    enabled: !!userId && activeTab === "bids",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴を取得
   */
  const { data: wonHistoryResult, isPending: isLoadingWon } = useQuery<WonAuctionItem[]>({
    queryKey: queryCacheKeys.auction.historyWon(userId!, currentPage, itemPerPage, wonStatus),
    queryFn: () => getUserWonAuctions(currentPage, userId!, itemPerPage, wonStatus),
    enabled: !!userId && activeTab === "won",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴の件数を取得
   * 件数とデータを別々に取得することで、ページを跨ぐごとに件数を取得しないので、サーバー負荷を少なくする
   */
  const { data: wonHistoryCount, isPending: isLoadingWonCount } = useQuery<number>({
    queryKey: queryCacheKeys.auction.historyWonCount(userId!, wonStatus),
    queryFn: () => getUserWonAuctionsCount(userId!, wonStatus),
    enabled: !!userId && activeTab === "won",
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴を取得
   */
  const { data: createdHistoryResult, isPending: isLoadingCreated } = useQuery<CreatedAuctionItem[]>({
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
   * 件数とデータを別々に取得することで、ページを跨ぐごとに件数を取得しないので、サーバー負荷を少なくする
   */
  const { data: createdHistoryCount, isPending: isLoadingCreatedCount } = useQuery<number>({
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

    const prefetchLogic = async <
      TQueryKey extends readonly unknown[],
      TData,
      TQueryKeyFnArgs extends unknown[],
      TFetchFnArgs extends unknown[],
    >(
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
          !!bidHistoryResult && bidHistoryResult.length > 0,
          queryCacheKeys.auction.historyBids,
          getUserBidHistories,
          [userId, nextPage, itemPerPage] as [string, number, number],
          [nextPage, userId, itemPerPage] as [number, string, number],
        );
        break;
      case "won":
        void prefetchLogic(
          wonHistoryCount,
          !!wonHistoryResult && wonHistoryResult.length > 0,
          queryCacheKeys.auction.historyWon,
          getUserWonAuctions,
          [userId, nextPage, itemPerPage, wonStatus] as [string, number, number, string],
          [nextPage, userId, itemPerPage, wonStatus] as [number, string, number, string],
        );
        break;
      case "created":
        void prefetchLogic(
          createdHistoryCount,
          !!createdHistoryResult && createdHistoryResult.length > 0,
          queryCacheKeys.auction.historyCreated,
          getUserCreatedAuctions,
          [userId, nextPage, itemPerPage, filter, filterCondition] as [
            string,
            number,
            number,
            AuctionCreatedTabFilter[],
            FilterCondition,
          ],
          [nextPage, userId, itemPerPage, filter, filterCondition] as [
            number,
            string,
            number,
            AuctionCreatedTabFilter[],
            FilterCondition,
          ],
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
    bidHistoryResult,
    bidHistoryCount,
    wonHistoryResult,
    wonHistoryCount,
    createdHistoryResult,
    createdHistoryCount,
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
        return wonHistoryCount ?? 0;
      case "created":
        return createdHistoryCount ?? 0;
      default:
        return 0;
    }
  }, [activeTab, bidHistoryCount, wonHistoryCount, createdHistoryCount]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Loadin中の表示条件
   */
  const isLoadingCurrentTab = useMemo(() => {
    if (!userId) return false;
    switch (activeTab) {
      case "bids":
        return isLoadingBidHistories || isLoadingBidHistoriesCount;
      case "won":
        return isLoadingWon || isLoadingWonCount;
      case "created":
        return isLoadingCreated || isLoadingCreatedCount;
      default:
        return false;
    }
  }, [
    activeTab,
    isLoadingBidHistories,
    isLoadingBidHistoriesCount,
    isLoadingWon,
    isLoadingWonCount,
    isLoadingCreated,
    isLoadingCreatedCount,
    userId,
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ナビゲーションを設定
   */
  const navigateToDetail = useCallback((path: string) => router.push(path), [router]);
  const handleItemClick = useCallback(
    (auctionId: string) => navigateToDetail(`/dashboard/auction/${auctionId}`),
    [navigateToDetail],
  );
  const handleWonItemClick = useCallback(
    (auctionId: string) => navigateToDetail(`/dashboard/auction/won-detail/${auctionId}`),
    [navigateToDetail],
  );
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
          const { ...rest } = prev;
          return { ...rest, tab: value, page: 1, wonStatus: "all", filter: null, condition: null };
        });
      } else if (value === "created") {
        // createdタブ: wonStatusを消す
        void setParams((prev) => {
          const { ...rest } = prev;
          return { ...rest, tab: value, page: 1, wonStatus: null };
        });
      } else {
        // bidsタブ: wonStatus, filter, conditionを消す
        void setParams((prev) => {
          const { ...rest } = prev;
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
    bidHistoryResult,
    wonHistoryResult,
    createdHistoryResult,
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
