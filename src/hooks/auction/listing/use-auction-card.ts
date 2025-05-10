"use client";

import { useCallback, useMemo, useState } from "react";
import { type AuctionCard } from "@/types/auction-types";
import { AuctionStatus } from "@prisma/client";
import { formatDistanceToNow, isWithinInterval, subDays } from "date-fns";
import { ja } from "date-fns/locale";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションカード用フックの型定義
 */
type UseAuctionCardReturn = {
  isStarted: boolean;
  isEnded: boolean;
  isNew: boolean;
  isEndingSoon: boolean;
  setIsEnded: (isEnded: boolean) => void;
  getStartMessage: () => string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションカード用フック
 * @param {AuctionCardHookProps} props オークションカード用フックのプロップ
 * @returns {AuctionCardHookResult} オークションカードの状態とハンドラー
 */
export function useAuctionCard({ auction }: { auction: AuctionCard }): UseAuctionCardReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在時刻とオークションの開始・終了時刻を比較
   */
  const now = useMemo(() => new Date(), []);
  const [isStarted] = useState(new Date(auction.start_time) <= now);
  const [isEnded, setIsEnded] = useState(new Date(auction.end_time) <= now || auction.status === AuctionStatus.ENDED);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 新着判定（過去3日以内の出品）
   * @returns {boolean} 新着判定
   */
  const isNew = useMemo(
    () =>
      isWithinInterval(new Date(auction.start_time), {
        start: subDays(new Date(), 3),
        end: new Date(),
      }),
    [auction.start_time],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * まもなく終了判定（24時間以内）
   * @returns {boolean} まもなく終了判定
   */
  const isEndingSoon = useMemo(
    () => isStarted && !isEnded && new Date(auction.end_time).getTime() - now.getTime() < 24 * 60 * 60 * 1000,
    [auction.end_time, isStarted, isEnded, now],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 開始前の場合のメッセージ
   * @returns {string} 開始前の場合のメッセージ
   */
  const getStartMessage = useCallback(() => {
    return `開始まで${formatDistanceToNow(new Date(auction.start_time), { locale: ja })}`;
  }, [auction.start_time]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    // state
    isStarted,
    isEnded,
    isNew,
    isEndingSoon,

    // action
    setIsEnded,
    getStartMessage,
  };
}
