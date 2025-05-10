"use client";

import type { AuctionFilterTypes, AuctionListingResult, AuctionListingsConditions, AuctionSortField, SortDirection } from "@/types/auction-types";
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAuctionListingsAndCount } from "@/lib/auction/action/auction-listing";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧画面のロジックを管理するカスタムフックの戻り値の型
 */
type UseAuctionListingsReturn = {
  // state
  auctions: AuctionListingResult;
  totalAuctionsCount: number;
  listingsConditions: AuctionListingsConditions;
  isLoading: boolean;

  // action
  setListingsConditions: (newListingsConditions: AuctionListingsConditions) => void;
};

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 * @returns オークション一覧画面のロジック
 * @description オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings(): UseAuctionListingsReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークション一覧データと総件数を並列で取得
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("ユーザーIDが取得できませんでした");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLからパラメータを取得
   */
  const searchParams = useSearchParams();

  // ページ数のURLパラメータ
  const currentPage = Number(searchParams.get("page") ?? 1);

  // カテゴリのURLパラメータ（複数可能）
  const currentCategoriesParams = searchParams.getAll("category");
  const currentCategories = currentCategoriesParams.length > 0 ? currentCategoriesParams : ["すべて"];

  // ステータスのURLパラメータ（複数可能）
  const currentStatusParams = searchParams.getAll("status");
  const currentStatus = currentStatusParams.length > 0 ? currentStatusParams.map((status) => status as AuctionFilterTypes) : ["all" as const];

  // ステータス結合タイプのURLパラメータ
  const currentStatusJoinType = searchParams.get("status_join_type") as "OR" | "AND" | null;

  // ソートのURLパラメータ
  const currentSort = searchParams.get("sort") as AuctionSortField | null;

  // ソートの降順/昇順の方向のURLパラメータ
  const currentSortDirection = searchParams.get("sort_direction") as SortDirection | null;

  // 検索クエリのURLパラメータ
  const currentQuery = searchParams.get("q");

  // 価格範囲フィルター
  const minBid = searchParams.get("min_bid") ? Number(searchParams.get("min_bid")) : null;
  const maxBid = searchParams.get("max_bid") ? Number(searchParams.get("max_bid")) : null;

  // 残り時間範囲フィルター (時間単位: 0-720時間 = 0-30日)
  const minRemainingTime = searchParams.get("min_remaining_time") ? Number(searchParams.get("min_remaining_time")) : null;
  const maxRemainingTime = searchParams.get("max_remaining_time") ? Number(searchParams.get("max_remaining_time")) : null;

  // グループリスト。複数あるのでgetAllで取得?groupId=1&groupId=2&groupId=3
  const groupIds = searchParams.getAll("group_id");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター状態。
   * 基本はuse-auction-filtersで使用するが、子コンポーネントに渡すために、ここで定義
   */
  const [listingsConditions, setListingsConditions] = useState<AuctionListingsConditions>({
    categories: currentCategories,
    status: currentStatus,
    statusConditionJoinType: currentStatusJoinType ?? "OR", // デフォルトはOR
    minBid: minBid,
    maxBid: maxBid,
    minRemainingTime: minRemainingTime,
    maxRemainingTime: maxRemainingTime,
    groupIds: groupIds.length > 0 ? groupIds : null,
    searchQuery: currentQuery,
    sort:
      currentSort && currentSortDirection
        ? [
            {
              field: currentSort,
              direction: currentSortDirection,
            },
          ]
        : null,
    page: currentPage,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLパラメータを更新する関数
   * 必要なパラメータのみURLに含める（デフォルト値は含めない）
   */
  const updateUrlParams = useCallback((newListingsConditions: AuctionListingsConditions) => {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_start", newListingsConditions);
    console.log(
      "src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_sort",
      newListingsConditions.sort ? JSON.stringify(newListingsConditions.sort) : "null",
    );

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const params = new URLSearchParams();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ページ数
    if (newListingsConditions.page > 1) {
      params.set("page", String(newListingsConditions.page));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // カテゴリ - 複数選択可能になったため、各カテゴリを追加
    if (newListingsConditions.categories && newListingsConditions.categories.length > 0 && !newListingsConditions.categories.includes("すべて")) {
      // 複数カテゴリを追加
      newListingsConditions.categories.forEach((category) => {
        if (category) params.append("category", category);
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ステータス
    if (newListingsConditions.status && newListingsConditions.status.length > 0 && newListingsConditions.status[0] !== "all") {
      newListingsConditions.status.forEach((status) => {
        params.append("status", status);
      });

      // ステータス結合タイプ
      if (newListingsConditions.statusConditionJoinType && newListingsConditions.statusConditionJoinType === "AND") {
        params.set("status_join_type", newListingsConditions.statusConditionJoinType);
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ソート - 複数選択可能になったため、最初のソート条件のみ使用
    if (newListingsConditions.sort && newListingsConditions.sort.length > 0) {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_listingsConditions.sort_start");
      const firstSort = newListingsConditions.sort[0];
      const defaultSort = newListingsConditions.searchQuery ? "relevance" : "newest";

      if (firstSort.field && firstSort.field !== defaultSort) {
        params.set("sort", firstSort.field);
        console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_firstSort.field", firstSort.field);
      }

      // ソート方向
      if (firstSort.direction && firstSort.direction !== "desc") {
        params.set("sort_direction", firstSort.direction);
        console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_firstSort.direction", firstSort.direction);
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 検索クエリ
    if (newListingsConditions.searchQuery) {
      params.set("q", newListingsConditions.searchQuery);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 価格範囲
    if (newListingsConditions.minBid !== null && newListingsConditions.minBid !== undefined && newListingsConditions.minBid !== 0) {
      params.set("min_bid", String(newListingsConditions.minBid));
    }
    if (newListingsConditions.maxBid !== null && newListingsConditions.maxBid !== undefined && newListingsConditions.maxBid !== 0) {
      params.set("max_bid", String(newListingsConditions.maxBid));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 残り時間範囲
    if (
      newListingsConditions.minRemainingTime !== null &&
      newListingsConditions.minRemainingTime !== undefined &&
      newListingsConditions.minRemainingTime !== 0
    ) {
      params.set("min_remaining_time", String(newListingsConditions.minRemainingTime));
    }
    if (
      newListingsConditions.maxRemainingTime !== null &&
      newListingsConditions.maxRemainingTime !== undefined &&
      newListingsConditions.maxRemainingTime !== 0
    ) {
      params.set("max_remaining_time", String(newListingsConditions.maxRemainingTime));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // グループID
    if (newListingsConditions.groupIds && newListingsConditions.groupIds.length > 0) {
      newListingsConditions.groupIds.forEach((id) => params.append("group_id", id));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // URLパラメータを作成
    const newUrl = `/dashboard/auction${params.toString() ? `?${params.toString()}` : ""}`;

    console.log("src/hooks/auction/listing/use-auction-listings.ts_updateUrlParams_newUrl", newUrl);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 指定URLに画面遷移。scroll: false を追加してページスクロールを防止
    window.history.pushState({}, "", newUrl);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データと総件数を並列で取得
   * queryKeyのstate更新のたびにデータ更新&キャッシュ追加
   * watchlist更新時もキャッシュの内容から更新されてそう
   */
  const { data: auctionListings, isPending } = useQuery({
    queryKey: ["auctionListings", listingsConditions, userId],
    queryFn: async () => await getAuctionListingsAndCount({ listingsConditions, userId }),
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    enabled: !!listingsConditions && !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    auctions: auctionListings?.listings ?? [],
    totalAuctionsCount: auctionListings?.count ?? 0,
    listingsConditions,
    isLoading: isPending,

    // action
    setListingsConditions: (newListingsConditions: AuctionListingsConditions) => {
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_newConditions", newListingsConditions);
      updateUrlParams(newListingsConditions);
      console.log("src/hooks/auction/listing/use-auction-listings.ts_setListingsConditions_after_state_update", newListingsConditions);
      setListingsConditions(newListingsConditions);
    },
  };
}
