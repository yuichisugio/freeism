"use client";

import { serverIsAuctionWatched, serverToggleWatchlist } from "@/lib/actions/auction/watchlist";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

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
    queryFn: () => serverIsAuctionWatched(auctionId, userId),
    initialData: initialData,
    retry: 3,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの切り替え
   */
  const { mutate: toggleWatchlist, isPending } = useMutation({
    mutationKey: queryCacheKeys.watchlist.update(userId),
    mutationFn: () => serverToggleWatchlist(auctionId, userId, isWatchlistedQueryData ?? false),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryCacheKeys.watchlist.userAuction(userId, auctionId) });
      const previousWatchlist = queryClient.getQueryData<boolean | null>(
        queryCacheKeys.watchlist.userAuction(userId, auctionId),
      );
      queryClient.setQueryData<boolean | null>(queryCacheKeys.watchlist.userAuction(userId, auctionId), (old) =>
        old === true ? false : true,
      );
      queryClient.getQueryData<boolean | null>(queryCacheKeys.watchlist.userAuction(userId, auctionId));
      return { previousWatchlist };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryCacheKeys.watchlist.userAuction(userId, auctionId), data);
      if (data) {
        toast.success("ウォッチリストに追加しました");
      } else {
        toast.success("ウォッチリストから削除しました");
      }
    },
    onError: (
      _error: Error,
      _variables: void,
      context: { previousWatchlist: boolean | null | undefined } | undefined,
    ) => {
      toast.error("ウォッチリストの更新中にエラーが発生しました");
      if (context?.previousWatchlist !== undefined) {
        queryClient.setQueryData(queryCacheKeys.watchlist.userAuction(userId, auctionId), context.previousWatchlist);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.watchlist.userAuction(userId, auctionId) });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const isWatchlisted = isWatchlistedQueryData ?? false;

  return {
    // state
    isLoading: isLoading || isPending,
    isWatchlisted: isWatchlisted,
    // action
    toggleWatchlist,
  };
}
