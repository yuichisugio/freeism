"use client";

import type { QueryKey } from "@tanstack/react-query"; // QueryKeyを型としてインポート
import { useMemo } from "react";
import { getAuctionMessagesAndSellerInfo, sendAuctionMessage } from "@/lib/auction/action/message";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージの型定義
 */
export type AuctionMessage = {
  id: string;
  message: string;
  auctionId: string;
  senderId: string;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
  };
  recipientId: string;
  recipient: {
    id: string;
    name: string | null;
    image: string | null;
  };
  createdAt: Date;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者情報の型定義
 */
export type SellerInfo = {
  id: string;
  name: string | null;
  image: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * APIレスポンスの型定義 (メッセージ送信API - POST成功時)
 */
type ApiPostSuccessResponse = {
  success: true;
  message: AuctionMessage;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを管理するカスタムフックの型
 */
export type UseAuctionMessageResult = {
  messages: AuctionMessage[];
  sellerId: string | null;
  sellerInfo: SellerInfo | null;
  loading: boolean; // データ取得中 (クエリ)
  error: string | null; // エラーメッセージ
  submitting: boolean; // 送信中 (ミューテーション)
  sendMessage: (variables: { messageText: string; recipientId: string }) => Promise<ApiPostSuccessResponse>;
  reloadMessages: () => Promise<void>;
  currentUserId: string | undefined;
  isSeller: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// 型定義: useQueryのqueryFnの戻り値
type AuctionQueryData = {
  messages: AuctionMessage[];
  sellerId: string | null;
  sellerInfo: SellerInfo | null;
};

/**
 * オークションメッセージを管理するカスタムフック
 * @param {string} auctionId オークションID
 * @returns {UseAuctionMessageResult} オークションメッセージの管理
 */
export function useAuctionMessage(auctionId: string): UseAuctionMessageResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション
   */
  const { data: session } = useSession();
  const currentUserId = useMemo(() => session?.user?.id, [session]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * queryClient
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージと出品者情報を取得する
   */
  const {
    data: queryData,
    isPending: isLoadingMessages,
    error: queryError,
    refetch,
  } = useQuery<AuctionQueryData, Error, AuctionQueryData, QueryKey>({
    queryKey: queryCacheKeys.auction.messages(auctionId),
    queryFn: async (): Promise<AuctionQueryData> => {
      const result = await getAuctionMessagesAndSellerInfo(auctionId);

      if (!result.success) {
        throw new Error(result.error ?? "メッセージの取得に失敗しました。");
      }

      return {
        messages: result.messages ?? [],
        sellerId: result.sellerInfo?.id ?? null,
        sellerInfo: result.sellerInfo ?? null,
      };
    },
    staleTime: 1000 * 60 * 30, // 30分
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!auctionId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージを送信する
   */
  const { mutateAsync: sendMessageMutation, isPending: isSendingMessage } = useMutation<
    ApiPostSuccessResponse,
    Error,
    { messageText: string; recipientId: string }
  >({
    mutationFn: async (variables: { messageText: string; recipientId: string }) => {
      const { messageText, recipientId } = variables;

      if (!messageText.trim() || !auctionId || !currentUserId || !recipientId) {
        throw new Error("メッセージ本文、オークションID、ユーザーID、または受信者IDが無効です。");
      }

      const result = await sendAuctionMessage(auctionId, messageText, recipientId);
      if (!result.success || !result.message) {
        throw new Error(result.error ?? "メッセージの送信に失敗しました");
      }
      return {
        success: true,
        message: result.message as AuctionMessage,
      };
    },
    onMutate: () => {
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.messages(auctionId) });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品者かどうか
   */
  const derivedSellerId = queryData?.sellerId ?? null;
  const isSeller = useMemo(() => !!currentUserId && !!derivedSellerId && currentUserId === derivedSellerId, [currentUserId, derivedSellerId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    messages: queryData?.messages ?? [],
    sellerId: queryData?.sellerId ?? null,
    sellerInfo: queryData?.sellerInfo ?? null,
    loading: isLoadingMessages,
    error: queryError?.message ?? null,
    submitting: isSendingMessage,
    currentUserId,
    isSeller,
    // functions
    sendMessage: sendMessageMutation,
    reloadMessages: async () => {
      await refetch();
    },
  };
}
