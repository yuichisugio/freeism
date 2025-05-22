"use client";

import type { AuctionFilterTypes, AuctionListingResult, AuctionListingsConditions, AuctionSortField, SortDirection } from "@/types/auction-types";
import { useCallback, useEffect, useMemo } from "react";
import { redirect } from "next/navigation";
import { getAuctionListingsAndCount } from "@/lib/auction/action/auction-listing";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs";

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 配列が等しいかどうかを判定するヘルパー関数 (null/undefinedも考慮)
 */
function arraysAreEqual(arr1: string[] | null | undefined, arr2: string[] | null | undefined): boolean {
  if (arr1 === arr2) return true; // 同じ参照または両方 null/undefined
  if (!arr1 || !arr2) return false; // どちらかが null/undefined
  if (arr1.length !== arr2.length) return false; // 長さが違う
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false; // 要素が違う
  }
  return true; // 長さも要素も同じ
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ソート配列が等しいかどうかを判定するヘルパー関数 (最初の要素のみ比較)
 */
function sortArraysAreEqual(
  arr1: { field: AuctionSortField; direction: SortDirection }[] | null | undefined,
  arr2: { field: AuctionSortField; direction: SortDirection }[] | null | undefined,
): boolean {
  if (arr1 === arr2) return true; // 同じ参照または両方 null/undefined
  // updateUrlParamsの実装に合わせて、配列がない場合と空配列は同じとみなす
  const isEmpty1 = !arr1 || arr1.length === 0;
  const isEmpty2 = !arr2 || arr2.length === 0;
  if (isEmpty1 && isEmpty2) return true; // 両方空またはnull
  if (isEmpty1 || isEmpty2) return false; // どちらか一方のみ空またはnull

  // 最初の要素のみ比較 (updateUrlParamsのロジックに合わせる)
  return arr1[0]?.field === arr2[0]?.field && arr1[0]?.direction === arr2[0]?.direction;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧画面のロジックを管理するカスタムフック
 * @returns オークション一覧画面のロジック
 * @description オークション一覧画面のロジックを管理するカスタムフック
 */
export function useAuctionListings(): UseAuctionListingsReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアントを取得
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションのuserIdを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * URLからパラメータを取得
   */
  const [params, setParams] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      category: parseAsArrayOf(parseAsString).withDefault(["すべて"]),
      status: parseAsArrayOf(parseAsString).withDefault(["all"]),
      status_join_type: parseAsString.withDefault("OR"),
      sort: parseAsString,
      sort_direction: parseAsString.withDefault("desc"),
      q: parseAsString,
      min_bid: parseAsInteger,
      max_bid: parseAsInteger,
      min_remaining_time: parseAsInteger,
      max_remaining_time: parseAsInteger,
      group_id: parseAsArrayOf(parseAsString),
    },
    {
      clearOnDefault: true,
      history: "push",
    },
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * AuctionListingsConditionsへの変換
   */
  const listingsConditions: AuctionListingsConditions = useMemo(() => {
    return {
      categories: params.category && params.category.length > 0 ? params.category : ["すべて"],
      status: params.status && params.status.length > 0 ? (params.status as AuctionFilterTypes[]) : ["all"],
      statusConditionJoinType: params.status_join_type === "AND" ? "AND" : "OR",
      minBid: params.min_bid ?? null,
      maxBid: params.max_bid ?? null,
      minRemainingTime: params.min_remaining_time ?? null,
      maxRemainingTime: params.max_remaining_time ?? null,
      groupIds: params.group_id && params.group_id.length > 0 ? params.group_id : null,
      searchQuery: params.q === undefined ? null : params.q,
      sort: params.sort ? [{ field: params.sort as AuctionSortField, direction: (params.sort_direction as SortDirection) ?? "desc" }] : null,
      page: params.page ?? 1,
    };
  }, [params]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * setListingsConditionsでURLパラメータを更新
   */
  const setListingsConditions = useCallback(
    (newListingsConditions: AuctionListingsConditions) => {
      // ページ以外の条件が変わったらページを1に戻す
      const conditionsChanged =
        listingsConditions.searchQuery !== newListingsConditions.searchQuery ||
        listingsConditions.statusConditionJoinType !== newListingsConditions.statusConditionJoinType ||
        listingsConditions.minBid !== newListingsConditions.minBid ||
        listingsConditions.maxBid !== newListingsConditions.maxBid ||
        listingsConditions.minRemainingTime !== newListingsConditions.minRemainingTime ||
        listingsConditions.maxRemainingTime !== newListingsConditions.maxRemainingTime ||
        !arraysAreEqual(listingsConditions.categories, newListingsConditions.categories) ||
        !arraysAreEqual(listingsConditions.status, newListingsConditions.status) ||
        !arraysAreEqual(listingsConditions.groupIds, newListingsConditions.groupIds) ||
        !sortArraysAreEqual(listingsConditions.sort, newListingsConditions.sort);
      const page = conditionsChanged ? 1 : newListingsConditions.page;
      void setParams({
        page: page === 1 ? null : page,
        category: arraysAreEqual(newListingsConditions.categories, ["すべて"]) ? null : newListingsConditions.categories,
        status: arraysAreEqual(newListingsConditions.status, ["all"]) ? null : newListingsConditions.status,
        status_join_type: newListingsConditions.statusConditionJoinType === "OR" ? null : newListingsConditions.statusConditionJoinType,
        sort: newListingsConditions.sort && newListingsConditions.sort.length > 0 ? newListingsConditions.sort[0].field : null,
        sort_direction:
          newListingsConditions.sort && newListingsConditions.sort.length > 0 && newListingsConditions.sort[0].direction !== "desc"
            ? newListingsConditions.sort[0].direction
            : null,
        q: newListingsConditions.searchQuery ?? null,
        min_bid: newListingsConditions.minBid ?? null,
        max_bid: newListingsConditions.maxBid ?? null,
        min_remaining_time: newListingsConditions.minRemainingTime ?? null,
        max_remaining_time: newListingsConditions.maxRemainingTime ?? null,
        group_id: newListingsConditions.groupIds && newListingsConditions.groupIds.length > 0 ? newListingsConditions.groupIds : null,
      });
    },
    [listingsConditions, setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション一覧データと総件数を並列で取得
   * queryKeyのstate更新のたびにデータ更新&キャッシュ追加
   * watchlist更新時もキャッシュの内容から更新されてそう
   */
  const {
    data: auctionListings,
    isPending,
    isPlaceholderData,
  } = useQuery({
    queryKey: queryCacheKeys.auction.userAllListings(userId, listingsConditions),
    queryFn: async () => await getAuctionListingsAndCount({ listingsConditions, userId }),
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!listingsConditions && !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 次のページをprefetch
   */
  useEffect(() => {
    // 現在のページ数
    const currentPage = listingsConditions.page;

    // 総ページ数
    const totalPages = Math.ceil((auctionListings?.count ?? 0) / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE);

    // データが取得されていて、かつ、現在のページ数が総ページ数より小さい場合
    if (!isPlaceholderData && !isPending && auctionListings?.count && currentPage < totalPages) {
      // 次のページ数
      const nextPage = currentPage + 1;

      // 次のページをprefetch
      void queryClient.prefetchQuery({
        queryKey: queryCacheKeys.auction.userAllListings(userId, { ...listingsConditions, page: nextPage }),
        queryFn: async () => await getAuctionListingsAndCount({ listingsConditions: { ...listingsConditions, page: nextPage }, userId }),
      });
      console.log("src/hooks/auction/listing/use-auction-listings.ts_prefetchQuery_nextPage", nextPage);
      console.log("src/hooks/auction/listing/use-auction-listings.ts_prefetchQuery_executed");
    }
    console.log("src/hooks/auction/listing/use-auction-listings.ts_prefetchQuery_end");
  }, [auctionListings, listingsConditions, isPlaceholderData, queryClient, isPending, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    auctions: auctionListings?.listings ?? [],
    totalAuctionsCount: auctionListings?.count ?? 0,
    listingsConditions: {
      ...listingsConditions,
      searchQuery: listingsConditions.searchQuery === undefined ? null : listingsConditions.searchQuery,
    },
    isLoading: isPending,

    // action
    setListingsConditions,
  };
}
