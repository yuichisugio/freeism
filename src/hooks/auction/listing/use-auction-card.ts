"use client";

import { useCallback, useMemo, useState } from "react";
import { type AuctionMessage, type AuctionPersonInfo } from "@/hooks/auction/bid/use-auction-qa";
import { getAuctionMessagesAndSellerInfo } from "@/lib/auction/action/auction-qa";
import { getAuctionByAuctionId } from "@/lib/auction/action/auction-retrieve";
import { getAutoBidByUserId } from "@/lib/auction/action/auto-bid";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { type AuctionCard } from "@/types/auction-types";
import { TaskStatus } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, isWithinInterval, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { useSession } from "next-auth/react";

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
  prefetchAuctionDetails: () => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション詳細関連データの型
 */
type AuctionQueryData = {
  messages: AuctionMessage[];
  sellerId: string | null;
  sellerInfo: AuctionPersonInfo | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションカード用フック
 * @param {AuctionCardHookProps} props オークションカード用フックのプロップ
 * @returns {UseAuctionCardHookResult} オークションカードの状態とハンドラー
 */
export function useAuctionCard({ auction }: { auction: AuctionCard }): UseAuctionCardReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = useMemo(() => session?.user?.id, [session]);

  /**
   * 現在時刻とオークションの開始・終了時刻を比較
   */
  const now = useMemo(() => new Date(), []);
  const [isStarted] = useState(new Date(auction.start_time) <= now);
  const [isEnded, setIsEnded] = useState(
    new Date(auction.end_time) <= now ||
      auction.status === TaskStatus.AUCTION_ENDED ||
      auction.status === TaskStatus.SUPPLIER_DONE ||
      auction.status === TaskStatus.TASK_COMPLETED ||
      auction.status === TaskStatus.FIXED_EVALUATED ||
      auction.status === TaskStatus.POINTS_AWARDED ||
      auction.status === TaskStatus.POINTS_DEPOSITED,
  );

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

  /**
   * オークション詳細関連データをプリフェッチする関数
   */
  const prefetchAuctionDetails = useCallback(async () => {
    console.log("src/hooks/auction/listing/use-auction-card.ts_prefetchAuctionDetails_start");

    // オークションIDがない場合はプリフェッチしない
    if (!auction.id) return;

    // 1. auction.messages のプリフェッチ
    await queryClient.prefetchQuery<AuctionQueryData, Error>({
      queryKey: queryCacheKeys.auction.messages(auction.id, false, auction.end_time),
      queryFn: async (): Promise<AuctionQueryData> => {
        const result = await getAuctionMessagesAndSellerInfo(auction.id, false, auction.end_time);
        if (!result.success) {
          return { messages: [], sellerId: null, sellerInfo: null };
        }
        return {
          messages: result.messages ?? [],
          sellerId: result.sellerInfo?.creator.id ?? null,
          sellerInfo: result.sellerInfo ?? null,
        };
      },
      staleTime: 1000 * 60 * 30, // 30分
      gcTime: 1000 * 60 * 60 * 1, // 1時間
    });

    // 2. auction.detail のプリフェッチ
    await queryClient.prefetchQuery({
      queryKey: queryCacheKeys.auction.detail(auction.id),
      queryFn: () => getAuctionByAuctionId(auction.id),
      staleTime: 1000 * 60 * 30, // 30分
      gcTime: 1000 * 60 * 60 * 1, // 1時間
    });

    // 3. auction.autoBid のプリフェッチ
    if (userId) {
      await queryClient.prefetchQuery({
        queryKey: queryCacheKeys.auction.autoBid(auction.id, userId, auction.current_highest_bid),
        queryFn: () => getAutoBidByUserId(auction.id, auction.current_highest_bid),
        staleTime: 1000 * 60 * 30, // 30分
        gcTime: 1000 * 60 * 60 * 1, // 1時間
      });
    }
  }, [auction.id, auction.current_highest_bid, userId, queryClient, auction.end_time]);

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
    prefetchAuctionDetails,
  };
}
