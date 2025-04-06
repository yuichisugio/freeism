"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// メッセージの型定義
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

// 出品者情報の型定義
export type SellerInfo = {
  id: string;
  name: string | null;
  image: string | null;
};

// APIレスポンスの型定義
type ApiSuccessResponse = {
  success: true;
  messages: AuctionMessage[];
  sellerId: string | null;
  sellerInfo: SellerInfo | null;
  message?: AuctionMessage;
};

type ApiErrorResponse = {
  success: false;
  error: string;
};

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

/**
 * オークションメッセージを管理するカスタムフック
 * @param auctionId オークションID
 */
export function useAuctionMessage(auctionId: string) {
  const [messages, setMessages] = useState<AuctionMessage[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

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

  // メッセージを送信する
  const sendMessage = async (messageText: string, recipientId: string) => {
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
        setMessages((prev) => [...prev, data.message!]);
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
  };

  // メッセージをリロードする
  const reloadMessages = async () => {
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
  };

  // 自分が出品者かどうか
  const isSeller = currentUserId === sellerId;

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
