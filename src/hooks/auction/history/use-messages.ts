"use client";

import type { AuctionMessage } from "@/lib/auction/action/history";
import type { QueryObserverResult } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuctionMessages, sendAuctionMessage } from "@/lib/auction/action/history";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージのカスタムフックの型
 */
type UseAuctionMessagesResult = {
  messages: AuctionMessage[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleSendMessage: () => void;
  refetchMessages: () => Promise<QueryObserverResult<AuctionMessage[], Error>>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージのカスタムフック
 * @param auctionId オークションID
 * @param winnerId 落札者ID（存在する場合）
 * @returns メッセージ関連の状態と関数
 */
export function useAuctionMessages(auctionId: string | undefined, winnerId: string | undefined): UseAuctionMessagesResult {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const query = useQuery<AuctionMessage[], Error>({
    queryKey: ["auctionMessages", auctionId],
    queryFn: async () => {
      if (!auctionId) return [];
      return getAuctionMessages(auctionId);
    },
    enabled: !!auctionId && !!winnerId,
  });

  const { mutate: sendMessageMutation, isPending: isSendingMessage } = useMutation<AuctionMessage, Error, string>({
    mutationFn: async (messageContent: string) => {
      if (!auctionId || !winnerId) {
        throw new Error("オークションIDまたは落札者IDが無効です");
      }
      return sendAuctionMessage(auctionId, winnerId, messageContent);
    },
    onSuccess: (sentMessage) => {
      queryClient.setQueryData<AuctionMessage[]>(["auctionMessages", auctionId], (oldMessages) =>
        oldMessages ? [...oldMessages, sentMessage] : [sentMessage],
      );
      setNewMessage("");
      toast.success("メッセージを送信しました");
    },
    onError: (error) => {
      console.error("メッセージの送信に失敗しました", error);
      toast.error("メッセージの送信に失敗しました: " + error.message);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [query.data]);

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    sendMessageMutation(newMessage);
  }, [newMessage, sendMessageMutation]);

  return {
    messages: query.data ?? [],
    newMessage,
    setNewMessage,
    isLoadingMessages: query.isLoading,
    isSendingMessage,
    messagesEndRef,
    handleSendMessage,
    refetchMessages: query.refetch,
  };
}
