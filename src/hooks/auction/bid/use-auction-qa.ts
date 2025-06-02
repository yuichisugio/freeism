"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getAuctionMessagesAndSellerInfo, sendAuctionMessage } from "@/lib/auction/action/auction-qa";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージの型定義
 */
export type AuctionMessage = {
  messageId: string;
  messageContent: string;
  createdAt: Date;
  person: {
    sender: {
      id: string;
      appUserName: string;
      image: string | null;
    };
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの出品者情報の型
 */
export type AuctionPersonInfo = {
  creator: {
    id: string;
  };
  reporters: {
    id: string | null;
  }[];
  executors: {
    id: string | null;
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを管理するカスタムフックの型
 */
export type UseAuctionMessageReturn = {
  messages: AuctionMessage[];
  auctionPersonInfo: AuctionPersonInfo | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  isSeller: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  form: ReturnType<typeof useForm<MessageFormValues>>;
  isRefetching: boolean;
  handleReload: () => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (data: MessageFormValues) => void;
  currentUserId: string;
  getSenderInfo: (
    senderId: string,
    auctionPersonInfo: AuctionPersonInfo | null,
    message: AuctionMessage,
    currentUserId: string,
  ) => {
    name: string;
    image: string | null;
    sellerTypes: ("creator" | "reporter" | "executor")[];
    isOwnMessage: boolean;
    isSellerMessage: boolean;
  };
  messagesContainerProps: {
    style?: React.CSSProperties;
    className?: string;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メッセージフォームのバリデーションスキーマ
 */
const messageFormSchema = z.object({
  message: z.string().trim().min(1, "メッセージを入力してください"),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メッセージフォームの値の型
 */
type MessageFormValues = z.infer<typeof messageFormSchema>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getAuctionMessagesAndSellerInfoの返り値型
 */
type AuctionMessagesAndSellerInfoResult = {
  success: boolean;
  messages: AuctionMessage[];
  sellerInfo: AuctionPersonInfo | null;
  error?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションメッセージを管理するカスタムフック
 * @param {string} auctionId オークションID
 * @returns {UseAuctionMessageReturn} オークションメッセージの管理
 */
export function useAuctionQA(auctionId: string, isEnd: boolean, isDisplayAfterEnd: boolean, auctionEndDate: Date): UseAuctionMessageReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッション
   */
  const { data: session } = useSession();
  const currentUserId = useMemo(() => session?.user?.id ?? "", [session]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * queryClient
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージリストの最下部の参照
   */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォームの初期化
   */
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { message: "" },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージと出品者情報を取得する
   */
  const {
    data: queryData,
    isPending: loading,
    error: queryError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: queryCacheKeys.auction.messages(auctionId, isDisplayAfterEnd, auctionEndDate),
    queryFn: async () => await getAuctionMessagesAndSellerInfo(auctionId, isDisplayAfterEnd, auctionEndDate),
    staleTime: 1000 * 60 * 30, // 30分
    gcTime: 1000 * 60 * 60 * 1, // 1時間
    enabled: !!auctionId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 受信者ID
   */
  const recipientIds = useMemo((): string[] => {
    if (!queryData?.sellerInfo?.creator.id) return [];
    const isNonNullString = (id: string | null): id is string => id !== null;
    const recipientIds = [
      queryData.sellerInfo.creator.id,
      ...queryData.sellerInfo.reporters.map((r) => r.id).filter(isNonNullString),
      ...queryData.sellerInfo.executors.map((e) => e.id).filter(isNonNullString),
    ];
    return Array.from(new Set(recipientIds));
  }, [queryData?.sellerInfo]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージを送信する
   */
  const { mutateAsync: sendMessageMutation, isPending: submitting } = useMutation({
    mutationFn: async (messageText: string) => {
      if (!messageText.trim() || !auctionId || !currentUserId || recipientIds.length === 0) {
        toast.error("メッセージ本文、オークションID、ユーザーID、または受信者IDが無効です。");
        return { success: false, message: null };
      }
      const result = await sendAuctionMessage(auctionId, messageText, recipientIds);
      if (!result.success || !result.message) {
        toast.error(result.error ?? "メッセージの送信に失敗しました");
        return { success: false, message: null };
      }
      return { success: true, message: result.message };
    },
    onSuccess: (data) => {
      if (data?.success && data.message) {
        // AuctionMessage型に整形
        const formattedMessage: AuctionMessage = {
          messageId: data.message.id,
          messageContent: data.message.message,
          createdAt: data.message.createdAt,
          person: {
            sender: {
              id: currentUserId,
              appUserName: session?.user?.name ?? "未設定",
              image: session?.user?.image ?? null,
            },
          },
        };
        queryClient.setQueryData<AuctionMessagesAndSellerInfoResult>(queryCacheKeys.auction.messages(auctionId, isEnd, auctionEndDate), (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...(old.messages ?? []), formattedMessage],
          };
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryCacheKeys.auction.messages(auctionId, isEnd, auctionEndDate) });
      form.reset();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージ送信ハンドラ
   */
  const handleSubmit = useCallback(
    (data: MessageFormValues) => {
      void sendMessageMutation(data.message);
    },
    [sendMessageMutation],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Command+Enterでのメッセージ送信
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        const messageText = form.getValues("message");
        if (messageText.trim()) {
          void form.handleSubmit(handleSubmit)();
        }
      }
    },
    [form, handleSubmit],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 送信順（createdAt昇順）でソートされたメッセージ配列
   */
  const sortedMessages = useMemo(() => {
    if (!queryData?.messages) return [];
    return [...queryData.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [queryData?.messages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージがロード後に最下部にスクロール
   */
  useEffect(() => {
    if (!loading && !submitting && !isRefetching && queryData?.messages && queryData.messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [loading, submitting, isRefetching, queryData?.messages?.length, queryData]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品者かどうか
   */
  const sellerId = queryData?.sellerInfo?.creator.id ?? null;
  const isSeller = !!currentUserId && !!sellerId && currentUserId === sellerId;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 再読み込み
   */
  const handleReload = useCallback(() => {
    void refetch();
  }, [refetch]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 送信者情報を取得するヘルパー
   */
  const getSenderInfo = useCallback(
    (
      senderId: string,
      auctionPersonInfo: AuctionPersonInfo | null,
      message: AuctionMessage,
      currentUserId: string,
    ): {
      name: string;
      image: string | null;
      sellerTypes: ("creator" | "reporter" | "executor")[];
      isOwnMessage: boolean;
      isSellerMessage: boolean;
    } => {
      const sellerTypes: ("creator" | "reporter" | "executor")[] = [];
      if (auctionPersonInfo) {
        if (senderId === auctionPersonInfo.creator.id) sellerTypes.push("creator");
        if (auctionPersonInfo.reporters.some((r) => r.id === senderId)) sellerTypes.push("reporter");
        if (auctionPersonInfo.executors.some((e) => e.id === senderId)) sellerTypes.push("executor");
      }
      const isOwnMessage = senderId === currentUserId;
      const senderInfo = isOwnMessage
        ? { name: "あなた", image: message.person?.sender?.image ?? null }
        : {
            name: message.person?.sender?.appUserName ?? "エラー",
            image: message.person?.sender?.image ?? null,
          };
      const isSellerMessage = sellerTypes.length > 0;
      return {
        name: senderInfo.name,
        image: senderInfo.image,
        sellerTypes,
        isOwnMessage,
        isSellerMessage,
      };
    },
    [],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 返り値
   */
  return {
    messages: sortedMessages,
    auctionPersonInfo: queryData?.sellerInfo ?? null,
    loading,
    error: queryError?.message ?? null,
    submitting,
    isSeller,
    messagesEndRef,
    form,
    currentUserId,
    isRefetching,
    handleReload,
    handleKeyDown,
    handleSubmit,
    getSenderInfo,
    messagesContainerProps: {
      style: {},
      className: "",
    },
  };
}
