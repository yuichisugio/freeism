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
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/types/auction-types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札・落札履歴のカスタムフック
 * @returns 入札・落札履歴のカスタムフック
 */
export function useAuctionHistory() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const VALID_TABS = useMemo(() => ["bids", "won", "created"] as const, []);
  type ValidTab = (typeof VALID_TABS)[number];

  const isValidTab = useCallback(
    (tab: string | null): tab is ValidTab => {
      if (!tab) return false;
      return VALID_TABS.some((validTab) => validTab === tab);
    },
    [VALID_TABS],
  );

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
   * urlが変わったらタブとページを取得
   * ページに戻ってきた時に実行
   */
  useEffect(() => {
    setActiveTab(getTabFromUrl());
    setCurrentPage(getPageFromUrl());
    setItemPerPage(getItemPerPageFromUrl());
  }, [getPageFromUrl, getTabFromUrl, getItemPerPageFromUrl, searchParams]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タブを変更
   */
  const handleTabChange = useCallback(
    (value: string) => {
      if (isValidTab(value)) {
        setActiveTab(value);
        setCurrentPage(1);
        router.push(`?tab=${value}&page=1`);
      }
    },
    [router, isValidTab],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ページを変更
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      setCurrentPage(newPage);
      router.push(`?tab=${activeTab}&page=${newPage}`);
    },
    [router, activeTab],
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
        router.push(`?tab=${activeTab}&page=1&itemPerPage=${newItemPerPage}`);
      }
    },
    [router, activeTab],
  );

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
    queryKey: queryCacheKeys.auction.historyCreated(userId!, currentPage, itemPerPage),
    queryFn: () => getUserCreatedAuctions(currentPage, userId!, itemPerPage),
    enabled: !!userId && activeTab === "created",
    placeholderData: keepPreviousData,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴の件数を取得
   */
  const { data: createdAuctionsCount, isPending: isLoadingCreatedCount } = useQuery<number>({
    queryKey: queryCacheKeys.auction.historyCreatedCount(userId!),
    queryFn: () => getUserCreatedAuctionsCount(userId!),
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

    const prefetchNextPage = async (
      fetchFn: (page: number, userId: string, itemsPerPage: number) => Promise<unknown>,
      queryKeyFn: (userId: string, page: number, itemsPerPage: number) => readonly unknown[],
      count: number | undefined,
      dataExists: boolean,
    ) => {
      if (dataExists && count !== undefined) {
        const totalPages = Math.ceil(count / itemPerPage);
        if (currentPage < totalPages) {
          const nextPage = currentPage + 1;
          await queryClient.prefetchQuery({
            queryKey: queryKeyFn(userId, nextPage, itemPerPage),
            queryFn: () => fetchFn(nextPage, userId, itemPerPage),
          });
        }
      }
    };

    switch (activeTab) {
      case "bids":
        void prefetchNextPage(
          getUserBidHistories,
          queryCacheKeys.auction.historyBids,
          bidHistoryCount,
          !!bidHistoryData && bidHistoryData.length > 0,
        );
        break;
      case "won":
        void prefetchNextPage(getUserWonAuctions, queryCacheKeys.auction.historyWon, wonAuctionsCount, !!wonHistoryData && wonHistoryData.length > 0);
        break;
      case "created":
        void prefetchNextPage(
          getUserCreatedAuctions,
          queryCacheKeys.auction.historyCreated,
          createdAuctionsCount,
          !!createdHistoryData && createdHistoryData.length > 0,
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
  const handleWonItemClick = useCallback((auctionId: string) => navigateToDetail(`/dashboard/auction/won/${auctionId}`), [navigateToDetail]);
  const handleCreatedItemClick = useCallback((auctionId: string) => navigateToDetail(`/dashboard/auction/created/${auctionId}`), [navigateToDetail]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札・落札履歴のカスタムフックの返却
   */
  return {
    // state
    activeTab,
    currentPage,
    itemPerPage,
    bidHistoryData: bidHistoryData ?? [],
    wonHistoryData: wonHistoryData ?? [],
    createdHistoryData: createdHistoryData ?? [],
    currentDataCount,
    isLoadingCurrentTab,
    userId,
    searchParams,
    // function
    handleItemClick,
    handleWonItemClick,
    handleCreatedItemClick,
    handleTabChange,
    handlePageChange,
    handleItemPerPageChange,
  };
}
