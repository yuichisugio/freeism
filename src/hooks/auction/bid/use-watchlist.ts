"use client";

import { serverIsAuctionWatched, serverToggleWatchlist } from "@/lib/auction/action/watchlist";
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

  console.log("src/hooks/auction/bid/use-watchlist.ts_useWatchlist_start", auctionId);

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
  const { data: isWatchlisted, isPending: isLoading } = useQuery({
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
    mutationFn: () => serverToggleWatchlist(auctionId, userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryCacheKeys.watchlist.userAuction(auctionId, userId) });
      const previousWatchlist = queryClient.getQueryData<boolean>(queryCacheKeys.watchlist.userAuction(auctionId, userId));
      queryClient.setQueryData(queryCacheKeys.watchlist.userAuction(auctionId, userId), (old: boolean | undefined) =>
        old === undefined ? undefined : !old,
      );
      return { previousWatchlist };
    },
    onError: (error: Error, _variables: void, context: { previousWatchlist: boolean | undefined } | undefined) => {
      toast.error("ウォッチリストの更新中にエラーが発生しました");
      if (context !== undefined) {
        queryClient.setQueryData(queryCacheKeys.watchlist.userAuction(auctionId, userId), context.previousWatchlist);
      }
      console.error("src/hooks/auction/bid/use-watchlist-actions.ts_toggleWatchlist_ウォッチリストAPI呼び出しエラー:", error);
    },
    onSettled: async (data) => {
      if (data) {
        console.log("src/hooks/auction/bid/use-watchlist-actions.ts_toggleWatchlist_ウォッチリストに追加しました");
        toast.success("ウォッチリストに追加しました");
      } else {
        console.log("src/hooks/auction/bid/use-watchlist-actions.ts_toggleWatchlist_ウォッチリストから削除しました");
        toast.success("ウォッチリストから削除しました");
      }
      await queryClient.invalidateQueries({ queryKey: queryCacheKeys.watchlist.userAuction(auctionId, userId) });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isLoading: isLoading || isPending,
    isWatchlisted: isWatchlisted!,
    // action
    toggleWatchlist,
  };
}
