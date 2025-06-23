"use client";

import type {
  AuctionListingResult,
  AuctionListingsConditions,
  AuctionSortField,
  SortDirection,
} from "@/types/auction-types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { redirect } from "next/navigation";
import { getAuctionListingsAndCount } from "@/lib/auction/action/auction-listing";
import { getUserGroupIds } from "@/lib/auction/action/auction-user-join-group-list";
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
  const a1 = arr1 ?? [];
  const a2 = arr2 ?? [];
  if (a1.length !== a2.length) return false;
  return a1.every((v, i) => v === a2[i]);
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
   * Hydrationの状態を管理 (SSR/CSRの不一致を防ぐため)
   */
  const [isHydrated, setIsHydrated] = useState(false);

  /**
   * Hydration完了後にフラグを立てる
   */
  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
      status_join_type: parseAsString.withDefault("AND"),
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
      status: params.status && params.status.length > 0 ? params.status : ["all"],
      joinType: params.status_join_type === "OR" ? "OR" : "AND",
      minBid: params.min_bid ?? null,
      maxBid: params.max_bid ?? null,
      minRemainingTime: params.min_remaining_time ?? null,
      maxRemainingTime: params.max_remaining_time ?? null,
      groupIds: params.group_id && params.group_id.length > 0 ? params.group_id : null,
      searchQuery: params.q === undefined ? null : params.q,
      sort: params.sort ? [{ field: params.sort, direction: params.sort_direction ?? "desc" }] : null,
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
        listingsConditions.joinType !== newListingsConditions.joinType ||
        listingsConditions.minBid !== newListingsConditions.minBid ||
        listingsConditions.maxBid !== newListingsConditions.maxBid ||
        listingsConditions.minRemainingTime !== newListingsConditions.minRemainingTime ||
        listingsConditions.maxRemainingTime !== newListingsConditions.maxRemainingTime ||
        !arraysAreEqual(listingsConditions.categories, newListingsConditions.categories) ||
        !arraysAreEqual(listingsConditions.status, newListingsConditions.status) ||
        !arraysAreEqual(listingsConditions.groupIds, newListingsConditions.groupIds) ||
        !sortArraysAreEqual(listingsConditions.sort, newListingsConditions.sort);
      const page = conditionsChanged ? 1 : newListingsConditions.page;

      // 常に更新するパラメータ（検索クエリや数値フィルターなど）
      const paramsToUpdate: Record<string, string | string[] | number | null> = {
        page: page === 1 ? null : page,
        q: newListingsConditions.searchQuery ?? null,
        min_bid: newListingsConditions.minBid ?? null,
        max_bid: newListingsConditions.maxBid ?? null,
        min_remaining_time: newListingsConditions.minRemainingTime ?? null,
        max_remaining_time: newListingsConditions.maxRemainingTime ?? null,
      };

      // categories が変更されている場合のみ更新
      if (!arraysAreEqual(listingsConditions.categories, newListingsConditions.categories)) {
        paramsToUpdate.category = arraysAreEqual(newListingsConditions.categories, ["すべて"])
          ? null
          : newListingsConditions.categories;
      }

      // status が変更されている場合のみ更新
      if (!arraysAreEqual(listingsConditions.status, newListingsConditions.status)) {
        paramsToUpdate.status = arraysAreEqual(newListingsConditions.status, ["all"])
          ? null
          : newListingsConditions.status;
      }

      // status_join_type が変更されている場合のみ更新
      if (listingsConditions.joinType !== newListingsConditions.joinType) {
        paramsToUpdate.status_join_type =
          newListingsConditions.joinType === "AND" ? null : newListingsConditions.joinType;
      }

      // sort が変更されている場合のみ更新
      if (!sortArraysAreEqual(listingsConditions.sort, newListingsConditions.sort)) {
        paramsToUpdate.sort =
          newListingsConditions.sort && newListingsConditions.sort.length > 0
            ? newListingsConditions.sort[0].field
            : null;
        paramsToUpdate.sort_direction =
          newListingsConditions.sort &&
          newListingsConditions.sort.length > 0 &&
          newListingsConditions.sort[0].direction !== "desc"
            ? newListingsConditions.sort[0].direction
            : null;
      }

      // group_id が変更されている場合のみ更新
      if (!arraysAreEqual(listingsConditions.groupIds, newListingsConditions.groupIds)) {
        // ①値がある → そのままセット
        if (newListingsConditions.groupIds?.length) {
          paramsToUpdate.group_id = newListingsConditions.groupIds;
        }
        // ②空になった → キーを渡さず削除 (omit)
        //    → 既存の値を保持したい場合はそもそも if に入らない
      }

      void setParams(paramsToUpdate);
    },
    [listingsConditions, setParams],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループIDを事前取得
   * オークション一覧取得で毎回同じデータを取得しないよう、事前にキャッシュしておく
   */
  const { data: userGroupIds } = useQuery({
    queryKey: queryCacheKeys.users.joinedGroupIds(userId),
    queryFn: async () => await getUserGroupIds(userId),
    staleTime: 1000 * 60 * 60 * 24, // 24時間（グループ参加は頻繁に変わらないため長めに設定）
    gcTime: 1000 * 60 * 60 * 24, // 24時間
    enabled: !!userId,
  });

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
    queryKey: queryCacheKeys.auction.userAllListings(userId, listingsConditions, userGroupIds ?? []),
    queryFn: async () =>
      await getAuctionListingsAndCount({ listingsConditions, userId, userGroupIds: userGroupIds ?? [] }),
    staleTime: 1000 * 60 * 60 * 1, // 1時間
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!listingsConditions && !!userId && !!userGroupIds, // userGroupIdsも有効になってから実行
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
        queryKey: queryCacheKeys.auction.userAllListings(
          userId,
          { ...listingsConditions, page: nextPage },
          userGroupIds ?? [],
        ),
        queryFn: async () =>
          await getAuctionListingsAndCount({
            listingsConditions: { ...listingsConditions, page: nextPage },
            userId,
            userGroupIds: userGroupIds ?? [],
          }),
      });
    }
  }, [auctionListings, listingsConditions, isPlaceholderData, queryClient, isPending, userId, userGroupIds]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    auctions: auctionListings?.listings ?? [],
    totalAuctionsCount: auctionListings?.count ?? 0,
    listingsConditions: {
      ...listingsConditions,
      searchQuery: listingsConditions.searchQuery === undefined ? null : listingsConditions.searchQuery,
    },
    isLoading: !isHydrated || isPending, // Hydration前は常にtrue、Hydration後はisPendingを返す

    // action
    setListingsConditions,
  };
}
