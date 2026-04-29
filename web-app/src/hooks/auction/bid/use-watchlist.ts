"use client";

import { serverIsAuctionWatched, serverToggleWatchlist } from "@/actions/auction/watchlist";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリスト操作用カスタムフックの型
 */
type UseWatchlistReturn = {
  // state
  isLoading: boolean;
  isWatchlisted: boolean;
  // action
  toggleWatchlist: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリスト操作用カスタムフック
 * @returns {UseWatchlistReturn} ウォッチリスト操作用の関数群
 */
export function useWatchlist(auctionId: string, initialData: boolean | null): UseWatchlistReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("ユーザーIDが取得できませんでした");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Tanstack Queryのクエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの状態を取得
   */
  const { data: isWatchlistedQueryData, isPending: isLoading } = useQuery({
    queryKey: queryCacheKeys.watchlist.userAuction(userId, auctionId),
    queryFn: async () => {
      const result = await serverIsAuctionWatched(auctionId, userId);
      return result.data;
    },
    initialData: initialData,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!auctionId && !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの切り替え
   */
  const { mutate: toggleWatchlist, isPending } = useMutation({
    mutationKey: queryCacheKeys.watchlist.update(userId),
    mutationFn: () => serverToggleWatchlist(auctionId, userId, isWatchlistedQueryData ?? false),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryCacheKeys.watchlist.userAuction(auctionId, userId) });
      const previousWatchlist = queryClient.getQueryData<boolean | null>(
        queryCacheKeys.watchlist.userAuction(auctionId, userId),
      );
      queryClient.setQueryData<boolean | null>(queryCacheKeys.watchlist.userAuction(auctionId, userId), (old) =>
        old === true ? false : true,
      );
      queryClient.getQueryData<boolean | null>(queryCacheKeys.watchlist.userAuction(userId, auctionId));
      return { previousWatchlist };
    },
    onError: (
      _error: Error,
      _variables: void,
      context: { previousWatchlist: boolean | null | undefined } | undefined,
    ) => {
      if (context?.previousWatchlist !== undefined) {
        queryClient.setQueryData(queryCacheKeys.watchlist.userAuction(auctionId, userId), context.previousWatchlist);
      }
    },
    meta: {
      invalidateCacheKeys: [{ queryKey: queryCacheKeys.watchlist.userAuction(auctionId, userId), exact: true }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isLoading: isLoading || isPending,
    isWatchlisted: isWatchlistedQueryData ?? false,
    // action
    toggleWatchlist,
  };
}
