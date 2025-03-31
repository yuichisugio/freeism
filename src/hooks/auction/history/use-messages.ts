"use client";

import type { AuctionMessage } from "@/lib/auction/action/history";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuctionMessages, sendAuctionMessage } from "@/lib/auction/action/history";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージのカスタムフック
 * @param auctionId オークションID
 * @param winnerId 落札者ID（存在する場合）
 * @returns メッセージ関連の状態と関数
 */
export function useAuctionMessages(auctionId: string, winnerId: string | undefined) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージ
  const [messages, setMessages] = useState<AuctionMessage[]>([]);

  // 新しいメッセージ
  const [newMessage, setNewMessage] = useState("");

  // メッセージの読み込みローディング
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // メッセージの送信ローディング
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // メッセージの読み込みローディング
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージを取得する
  const fetchMessages = useCallback(async () => {
    if (!winnerId) return;

    setIsLoadingMessages(true);
    try {
      const fetchedMessages = await getAuctionMessages(auctionId);
      setMessages(fetchedMessages);
    } catch (error) {
      console.error("メッセージの取得に失敗しました", error);
      toast.error("メッセージの取得に失敗しました");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [auctionId, winnerId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージ履歴を読み込む
  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージを送信する
  const handleSendMessage = useCallback(async () => {
    if (!winnerId || !newMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      const sentMessage = await sendAuctionMessage(auctionId, winnerId, newMessage);
      setMessages((prev) => [...prev, sentMessage]);
      setNewMessage("");
      toast.success("メッセージを送信しました");
    } catch (error) {
      console.error("メッセージの送信に失敗しました", error);
      toast.error("メッセージの送信に失敗しました");
    } finally {
      setIsSendingMessage(false);
    }
  }, [auctionId, winnerId, newMessage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    messages,
    newMessage,
    setNewMessage,
    isLoadingMessages,
    isSendingMessage,
    messagesEndRef,
    handleSendMessage,
    fetchMessages,
  };
}
