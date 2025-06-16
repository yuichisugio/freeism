"use client";

import { useCallback, useEffect, useState } from "react";
import { executeBid } from "@/lib/auction/action/bid/bid-common";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札操作用カスタムフックの型
 */
type UseBidActionsResult = {
  submitting: boolean;
  bidAmount: number;
  minBid: number;
  error: string | null;
  setBidAmount: React.Dispatch<React.SetStateAction<number>>;
  incrementBid: () => void;
  decrementBid: () => void;
  onSubmit: (bidRequest: BidRequest) => Promise<BidResponse>;
};

/**
 * 入札リクエストの型
 */
type BidRequest = {
  auctionId: string;
  amount: number;
  isAutoBid: boolean;
};

/**
 * 入札レスポンスの型
 */
type BidResponse = {
  success: boolean;
  message: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札操作用カスタムフック
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @returns {UseBidActionsResult} 入札操作用の関数群
 */
export function useBidActions(auctionId: string, currentHighestBid: number): UseBidActionsResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // TanStack Query クライアント
  const queryClient = useQueryClient();

  // 入札額を管理するuseState
  const [bidAmount, setBidAmount] = useState(currentHighestBid + 1);

  // 最低入札額は現在価格の1ポイント増し
  const [minBid] = useState(currentHighestBid + 1);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * TanStack Query v5 の useMutation を使用した入札処理
   */
  const {
    mutateAsync: placeBidMutation,
    isPending: submitting,
    reset: resetMutation,
    error,
  } = useMutation<BidResponse, Error, BidRequest>({
    onMutate: () => {
      resetMutation();
    },
    mutationFn: async (bidRequest: BidRequest) => {
      if (bidAmount < minBid) {
        toast.error("入札額が最低入札額未満です");
        return {
          success: false,
          message: "入札額が最低入札額未満です",
        };
      }

      const result = await executeBid(bidRequest.auctionId, bidRequest.amount, bidRequest.isAutoBid);
      if (!result.success) {
        throw new Error(result.message ?? "入札に失敗しました");
      }

      return result;
    },
    onSuccess: (data: BidResponse) => {
      // 関連するキャッシュを無効化
      void queryClient.invalidateQueries({
        queryKey: queryCacheKeys.auction.detail(auctionId),
        exact: false,
      });

      // 入札履歴関連のクエリも無効化
      void queryClient.invalidateQueries({
        queryKey: queryCacheKeys.auction.history(),
        exact: false,
      });

      // 入札関連のクエリも無効化
      void queryClient.invalidateQueries({
        queryKey: queryCacheKeys.auction.bid(auctionId),
        exact: false,
      });

      // 警告メッセージがある場合は設定、そうでなければ成功メッセージ
      if (data.message) {
        toast.warning(data.message);
      } else {
        toast.success("入札が完了しました");
      }

      // 入札成功後、前回の入札額に1ポイント加算した金額を入札額に設定
      setBidAmount(bidAmount + 1);
    },
    onError: (error: Error) => {
      console.error("src/hooks/auction/bid/use-bid-actions.ts_onError:", error);
      toast.error(error.message || "入札処理中にエラーが発生しました");
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 現在の最高入札額が変更された場合、入札額を更新
   */
  useEffect(() => {
    // 最低入札額は現在価格の1ポイント増し。現在の入札額が、他社が入札して更新された額より小さい場合は1ポイント増し
    if (currentHighestBid >= bidAmount) {
      setBidAmount(currentHighestBid + 1);
    }
  }, [currentHighestBid, bidAmount]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札額をインクリメント
   */
  const incrementBid = useCallback(() => {
    setBidAmount((prev: number) => prev + 1);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札額をデクリメント（最小入札額未満にはならないように）
   */
  const decrementBid = useCallback(() => {
    if (bidAmount > minBid) {
      setBidAmount((prev: number) => prev - 1);
    }
  }, [bidAmount, minBid]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    submitting,
    bidAmount,
    minBid,
    error: error?.message ?? null,
    setBidAmount,
    incrementBid,
    decrementBid,
    onSubmit: placeBidMutation,
  };
}
