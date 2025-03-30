"use client";

import { useCallback, useState } from "react";
import { type AuctionCardHookProps, type SellerRating } from "@/lib/auction/type/types";
import { AuctionStatus } from "@prisma/client";
import { formatDistanceToNow, isWithinInterval, subDays } from "date-fns";
import { ja } from "date-fns/locale";

/**
 * オークションカード用フック
 * @param auction オークション
 * @param onToggleWatchlistAction ウォッチリスト更新アクション
 * @returns オークションカードの状態とハンドラー
 */
export function useAuctionCard({ auction, onToggleWatchlistAction }: AuctionCardHookProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリスト更新中の状態
  const [isUpdating, setIsUpdating] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 現在時刻とオークションの開始・終了時刻を比較
  const now = new Date();
  const [isStarted] = useState(new Date(auction.startTime) <= now);
  const [isEnded, setIsEnded] = useState(new Date(auction.endTime) <= now || auction.status === AuctionStatus.ENDED);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 新着判定（過去3日以内の出品）
  const isNew = isWithinInterval(new Date(auction.startTime), {
    start: subDays(new Date(), 3),
    end: new Date(),
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // まもなく終了判定（24時間以内）
  const isEndingSoon = isStarted && !isEnded && new Date(auction.endTime).getTime() - now.getTime() < 24 * 60 * 60 * 1000;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリストの切り替え
  const handleToggleWatchlist = useCallback(async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggleWatchlistAction(auction.id);
    } finally {
      setIsUpdating(false);
    }
  }, [auction.id, isUpdating, onToggleWatchlistAction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 開始前の場合のメッセージ
  const getStartMessage = useCallback(() => {
    return `開始まで${formatDistanceToNow(new Date(auction.startTime), { locale: ja })}`;
  }, [auction.startTime]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 出品者の評価を計算
  const getSellerRating = useCallback((): SellerRating => {
    if (auction.seller.rating === null) {
      return {
        fullStars: 0,
        hasHalfStar: false,
        emptyStars: 0,
        ratingValue: null,
      };
    }

    // 5つ星評価の表示
    const fullStars = Math.floor(auction.seller.rating);
    const hasHalfStar = auction.seller.rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return {
      fullStars,
      hasHalfStar,
      emptyStars,
      ratingValue: auction.seller.rating,
    };
  }, [auction.seller.rating]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    isUpdating,
    isStarted,
    isEnded,
    isNew,
    isEndingSoon,
    setIsEnded,
    handleToggleWatchlist,
    getStartMessage,
    sellerRating: getSellerRating(),
  };
}
