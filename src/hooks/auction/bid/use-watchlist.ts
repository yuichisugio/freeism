"use client";

import { serverIsAuctionWatched, serverToggleWatchlist } from "@/lib/auction/action/watchlist";
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
    queryKey: ["watchlist", auctionId, userId],
    queryFn: () => serverIsAuctionWatched(auctionId, userId),
    initialData: initialData ?? serverIsAuctionWatched(auctionId, userId), // 入札画面は初期データがnullなのでの場合はサーバーから取得
    retry: 3,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの切り替え
   */
  const { mutate: toggleWatchlist, isPending } = useMutation({
    mutationKey: ["toggleWatchlist", auctionId, userId],
    mutationFn: () => serverToggleWatchlist(auctionId, userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["watchlist", auctionId, userId] });
      const previousWatchlist = queryClient.getQueryData<boolean>(["watchlist", auctionId, userId]);
      queryClient.setQueryData(["watchlist", auctionId, userId], (old: boolean | undefined) => (old === undefined ? undefined : !old));
      return { previousWatchlist };
    },
    onError: (error: Error, _variables: void, context: { previousWatchlist: boolean | undefined } | undefined) => {
      toast.error("ウォッチリストの更新中にエラーが発生しました");
      if (context !== undefined) {
        queryClient.setQueryData(["watchlist", auctionId, userId], context.previousWatchlist);
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
      await queryClient.invalidateQueries({ queryKey: ["watchlist", auctionId, userId] });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isLoading: isLoading || isPending,
    isWatchlisted: isWatchlisted as boolean,
    // action
    toggleWatchlist,
  };
}
