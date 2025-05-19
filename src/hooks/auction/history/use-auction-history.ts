"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// AuctionCreatedTabFilter の有効な値を定義
const auctionCreatedTabFilterValues: ReadonlyArray<AuctionCreatedTabFilter> = [
  "all",
  "active",
  "ended",
  "pending",
  "creator",
  "executor",
  "reporter",
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 文字列が AuctionCreatedTabFilter の有効な値かどうかをチェックする関数
 * @param value チェックする文字列
 * @returns 有効な場合は true、そうでない場合は false
 */
function isValidAuctionCreatedTabFilter(value: string): value is AuctionCreatedTabFilter {
  return auctionCreatedTabFilterValues.includes(value as AuctionCreatedTabFilter);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札・落札履歴のカスタムフック
 * @returns 入札・落札履歴のカスタムフック
 */
export function useAuctionHistory() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブの定義
   */
  const VALID_TABS = useMemo(() => ["bids", "won", "created"] as const, []);
  type ValidTab = (typeof VALID_TABS)[number];

  /**
   * UIで表示するフィルターの定義 ("all" を除く)
   */
  const VALID_UI_FILTERS = useMemo(() => ["active", "ended", "pending", "creator", "executor", "reporter"] as const, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブが有効かどうかをチェックする関数
   */
  const isValidTab = useCallback(
    (tab: string | null): tab is ValidTab => {
      if (!tab) return false;
      return VALID_TABS.some((validTab) => validTab === tab);
    },
    [VALID_TABS],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
   * タブを取得
   */
  const getTabFromUrl = useCallback(() => {
    const tab = searchParams.get("tab");
    return isValidTab(tab) ? tab : "bids";
  }, [searchParams, isValidTab]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページを取得
   */
  const getPageFromUrl = useCallback(() => {
    const page = searchParams.get("page");
    const pageNumber = parseInt(page ?? "1", 10);
    return (isNaN(pageNumber) ?? pageNumber < 1) ? 1 : pageNumber;
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページあたりのアイテム数をURLから取得する関数
   */
  const getItemPerPageFromUrl = useCallback(() => {
    const items = searchParams.get("itemPerPage");
    const itemsNumber = parseInt(items ?? AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE.toString(), 10);
    return isNaN(itemsNumber) || itemsNumber < 1 ? AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE : itemsNumber;
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLからフィルターを取得する関数
   */
  const getFiltersFromUrl = useCallback((): AuctionCreatedTabFilter[] => {
    const filterParam = searchParams.get("filter");
    if (filterParam) {
      const filters = filterParam.split(",").filter((f) => f.length > 0);
      return filters.filter(isValidAuctionCreatedTabFilter);
    }
    return []; // デフォルトは空配列（＝全て）
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLからフィルター条件(AND/OR)を取得する関数
   */
  const getFilterConditionFromUrl = useCallback((): FilterCondition => {
    const condition = searchParams.get("condition");
    return condition === "and" || condition === "or" ? condition : "or"; // デフォルトは OR
  }, [searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター条件(AND/OR)を取得
   */
  const [filterCondition, setFilterCondition] = useState<FilterCondition>(getFilterConditionFromUrl());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブを取得
   */
  const [activeTab, setActiveTab] = useState<ValidTab>(getTabFromUrl());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページを取得
   */
  const [currentPage, setCurrentPage] = useState<number>(getPageFromUrl());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページあたりのアイテム数を取得
   */
  const [itemPerPage, setItemPerPage] = useState<number>(getItemPerPageFromUrl());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターを取得
   */
  const [filter, setFilter] = useState<AuctionCreatedTabFilter[]>(getFiltersFromUrl());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * urlが変わったらタブとページとフィルターとフィルター条件を取得
   * ページに戻ってきた時に実行
   */
  useEffect(() => {
    setActiveTab(getTabFromUrl());
    setCurrentPage(getPageFromUrl());
    setItemPerPage(getItemPerPageFromUrl());
    setFilter(getFiltersFromUrl());
    setFilterCondition(getFilterConditionFromUrl());
  }, [getPageFromUrl, getTabFromUrl, getItemPerPageFromUrl, getFiltersFromUrl, getFilterConditionFromUrl, searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブを変更
   */
  const handleTabChange = useCallback(
    (value: string) => {
      if (isValidTab(value)) {
        setActiveTab(value);
        setCurrentPage(1);
        // フィルターはタブ変更時にリセットしない（URLから再取得されるため）
        const currentFilterParam = filter.length > 0 ? `&filter=${filter.join(",")}` : "";
        const currentConditionParam = activeTab === "created" && filter.length > 0 ? `&condition=${filterCondition}` : "";
        router.push(`?tab=${value}&page=1&itemPerPage=${itemPerPage}${currentFilterParam}${currentConditionParam}`);
      }
    },
    [router, isValidTab, filter, itemPerPage, filterCondition, activeTab],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページを変更
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setCurrentPage(newPage);
      const filterParam = filter.length > 0 ? `&filter=${filter.join(",")}` : "";
      const conditionParam = activeTab === "created" && filter.length > 0 ? `&condition=${filterCondition}` : "";
      router.push(`?tab=${activeTab}&page=${newPage}&itemPerPage=${itemPerPage}${filterParam}${conditionParam}`);
    },
    [router, activeTab, itemPerPage, filter, filterCondition],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 表示件数を変更
   */
  const handleItemPerPageChange = useCallback(
    (newItemPerPage: number) => {
      if (newItemPerPage > 0) {
        setItemPerPage(newItemPerPage);
        setCurrentPage(1);
        const filterParam = filter.length > 0 ? `&filter=${filter.join(",")}` : "";
        const conditionParam = activeTab === "created" && filter.length > 0 ? `&condition=${filterCondition}` : "";
        router.push(`?tab=${activeTab}&page=1&itemPerPage=${newItemPerPage}${filterParam}${conditionParam}`);
      }
    },
    [router, activeTab, filter, filterCondition],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターを変更
   */
  const handleFilterChange = useCallback(
    (newFilter: AuctionCreatedTabFilter[]) => {
      setFilter(newFilter);
      setCurrentPage(1); // フィルター変更時は1ページ目に戻す
      const filterParam = newFilter.length > 0 ? `&filter=${newFilter.join(",")}` : "";
      const conditionParam = activeTab === "created" && newFilter.length > 0 ? `&condition=${filterCondition}` : "";
      router.push(`?tab=${activeTab}&page=1&itemPerPage=${itemPerPage}${filterParam}${conditionParam}`);
    },
    [router, activeTab, itemPerPage, filterCondition],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター条件(AND/OR)を変更
   */
  const handleFilterConditionChange = useCallback(
    (newCondition: FilterCondition) => {
      setFilterCondition(newCondition);
      setCurrentPage(1); // 条件変更時も1ページ目に戻す
      const filterParam = filter.length > 0 ? `&filter=${filter.join(",")}` : "";
      // フィルターが空の場合は condition を URL に含めない
      const conditionParam = filter.length > 0 ? `&condition=${newCondition}` : "";
      router.push(`?tab=${activeTab}&page=1&itemPerPage=${itemPerPage}${filterParam}${conditionParam}`);
    },
    [router, activeTab, itemPerPage, filter],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターをクリア
   */
  const handleClearFilters = useCallback(() => {
    setFilter([]);
    setCurrentPage(1); // フィルタークリア時も1ページ目に戻す
    // filterCondition はクリアせず、現在の値を維持する（ユーザーが意図的に変更するまで）
    // ただし、フィルターが空になるので、URLからは condition パラメータは消える
    router.push(`?tab=${activeTab}&page=1&itemPerPage=${itemPerPage}`);
  }, [router, activeTab, itemPerPage]);

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
   * 入札履歴のページを変えるたびに件数をアクセスしないように、件数取得の関数は別で用意する
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
