"use client";

import { getAuctionHistoryCreatedDetail, getWinnerRating } from "@/lib/auction/action/created-detail";
import { useQuery } from "@tanstack/react-query";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 */
export function useAuctionHistoryCreatedDetailInit(auctionId: string, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を取得
   */
  const { data: auction, isPending: isAuctionLoading } = useQuery({
    queryKey: ["auction", auctionId, userId],
    queryFn: () => getAuctionHistoryCreatedDetail(auctionId, userId),
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const { data: winnerInfo, isPending: isWinnerRatingLoading } = useQuery({
    queryKey: ["winnerRating", auction?.winner?.id],
    queryFn: () => getWinnerRating(auction?.winner?.id ?? ""),
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細を返却
   */
  return {
    auction: auction ?? null,
    winnerRating: winnerInfo?.winnerRating ?? 0,
    winnerReviewCount: winnerInfo?.winnerReviewCount ?? 0,
    isLoading: isAuctionLoading || isWinnerRatingLoading,
  };
}
