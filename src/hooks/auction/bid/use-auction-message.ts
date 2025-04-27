"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
 * APIレスポンスの型定義
 */
type ApiSuccessResponse = {
  success: true;
  messages: AuctionMessage[];
  sellerId: string | null;
  sellerInfo: SellerInfo | null;
  message: AuctionMessage;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * APIエラーレスポンスの型定義
 */
type ApiErrorResponse = {
  success: false;
  error: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * APIレスポンスの型定義
 */
type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを管理するカスタムフックの型
 */
type UseAuctionMessageResult = {
  messages: AuctionMessage[];
  sellerId: string | null;
  sellerInfo: SellerInfo | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  sendMessage: (messageText: string, recipientId: string) => Promise<boolean>;
  reloadMessages: () => Promise<void>;
  currentUserId: string | undefined;
  isSeller: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを管理するカスタムフック
 * @param {string} auctionId オークションID
 * @returns {UseAuctionMessageResult} オークションメッセージの管理
 */
export function useAuctionMessage(auctionId: string): UseAuctionMessageResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [messages, setMessages] = useState<AuctionMessage[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const { data: session } = useSession();
  const currentUserId = useMemo(() => session?.user?.id, [session]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージと出品者情報を取得する
  useEffect(() => {
    async function fetchMessagesAndSellerInfo() {
      try {
        setLoading(true);

        // APIを使用してデータを取得
        const response = await fetch(`/api/auctions/${auctionId}/messages`);
        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          setError("error" in data ? data.error : "メッセージの取得に失敗しました");
          return;
        }

        if (data.success) {
          setSellerId(data.sellerId);
          setSellerInfo(data.sellerInfo);
          setMessages(data.messages);
          setError(null);
        } else {
          setError(data.error);
        }
      } catch (err) {
        console.error("メッセージ取得エラー:", err);
        setError("メッセージの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    }

    if (auctionId) {
      void fetchMessagesAndSellerInfo();
    }
  }, [auctionId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージを送信する
  const sendMessage = useCallback(
    async (messageText: string, recipientId: string) => {
      if (!messageText.trim() || !auctionId || !currentUserId) return false;

      try {
        setSubmitting(true);

        // APIを使用してメッセージを送信
        const response = await fetch(`/api/auctions/${auctionId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: messageText,
            recipientId,
          }),
        });

        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          setError("error" in data ? data.error : "メッセージの送信に失敗しました");
          return false;
        }

        if (data.success && data.message) {
          // 成功した場合、メッセージリストを更新
          setMessages((prev) => [...prev, data.message]);
          return true;
        } else {
          setError("error" in data ? data.error : "メッセージの送信に失敗しました");
          return false;
        }
      } catch (err) {
        console.error("メッセージ送信エラー:", err);
        setError("メッセージの送信中にエラーが発生しました");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [auctionId, currentUserId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージをリロードする
  const reloadMessages = useCallback(async () => {
    try {
      setLoading(true);

      // APIを使用してデータを再取得
      const response = await fetch(`/api/auctions/${auctionId}/messages`);
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError("error" in data ? data.error : "メッセージのリロードに失敗しました");
        return;
      }

      if (data.success) {
        setMessages(data.messages);
        setSellerId(data.sellerId);
        setSellerInfo(data.sellerInfo);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error("メッセージリロードエラー:", err);
      setError("メッセージのリロード中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 自分が出品者かどうか
  const isSeller = useMemo(() => currentUserId === sellerId, [currentUserId, sellerId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    messages,
    sellerId,
    sellerInfo,
    loading,
    error,
    submitting,
    sendMessage,
    reloadMessages,
    currentUserId,
    isSeller,
  };
}
