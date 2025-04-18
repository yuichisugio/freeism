"use client";

import type { AuctionMessage } from "@/hooks/auction/bid/use-auction-message";
import type { KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useAuctionMessage } from "@/hooks/auction/bid/use-auction-message";
import { cn, formatRelativeTime } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageSquare, RefreshCw, SendHorizonal } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";

// --------------------------------------------------

/**
 * メッセージフォームのバリデーションスキーマ
 */
const messageFormSchema = z.object({
  message: z.string().min(1, "メッセージを入力してください"),
});

// --------------------------------------------------

/**
 * メッセージフォームの値の型
 */
type MessageFormValues = z.infer<typeof messageFormSchema>;

// --------------------------------------------------

/**
 * オークションの質問と回答コンポーネント
 */
export const AuctionQA = memo(function AuctionQA({ auctionId }: { auctionId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const { messages, sellerId, loading, error, submitting, sendMessage, reloadMessages, currentUserId, isSeller } = useAuctionMessage(auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [reloading, setReloading] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フォームの初期化
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      message: "",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージ送信処理
  const onSubmit = useCallback(
    async (data: MessageFormValues) => {
      // 出品者へのメッセージを送信する
      const success = await sendMessage(data.message, sellerId ?? "");
      if (success) {
        // フォームをリセット
        form.reset();
        // 最新のメッセージにスクロール
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    },
    [form, messagesEndRef, sendMessage, sellerId],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // Command+Enterでのメッセージ送信
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter単体での送信を防止
      if (e.key === "Enter" && !e.metaKey) {
        e.preventDefault();
      }

      // Command+Enterでフォーム送信
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        void form.handleSubmit(onSubmit)();
      }
    },
    [form, onSubmit],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージリロード処理
  const handleReload = useCallback(async () => {
    setReloading(true);
    await reloadMessages();
    setReloading(false);
  }, [reloadMessages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージをグループ化する（自分/相手のメッセージ）
  const groupedMessages = useMemo(() => {
    return messages.reduce<Record<string, AuctionMessage[]>>((groups, message) => {
      // 自分のメッセージか相手のメッセージかでグループ化
      const key = message.senderId === currentUserId ? "self" : message.senderId;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(message);
      return groups;
    }, {});
  }, [messages, currentUserId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 表示用にタイムスタンプでソートされたメッセージグループの配列を作成
  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedMessages).sort((a, b) => {
      const timeA = new Date(groupedMessages[a][0].createdAt).getTime();
      const timeB = new Date(groupedMessages[b][0].createdAt).getTime();
      return timeA - timeB;
    });
  }, [groupedMessages]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // メッセージがロード後に最下部にスクロール
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [loading, messages.length]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ローディング表示
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
        <Loader2 className="text-primary mr-2 h-6 w-6 animate-spin" />
        <p className="text-muted-foreground">メッセージを読み込み中...</p>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // エラー表示
  if (error) {
    return (
      <div className="border-destructive text-destructive bg-destructive/5 rounded-xl border p-6 text-center shadow-sm">
        <p>{error}</p>
        <Button onClick={handleReload} variant="outline" className="mt-4">
          再読み込み
        </Button>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-full flex-col space-y-4 rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-5 shadow-md">
      {/* メッセージヘッダー */}
      <div className="flex items-center justify-between rounded-lg border-b border-slate-100 bg-white p-3 shadow-sm">
        {/* メッセージヘッダーの左側 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-full bg-indigo-100 p-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-800">質問と回答</h3>
          {isSeller && (
            <Badge variant="secondary" className="ml-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
              出品者
            </Badge>
          )}
        </div>

        {/* メッセージヘッダーの右側。リロードボタン */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReload}
          disabled={reloading}
          className="h-8 w-8 rounded-full p-0 hover:bg-indigo-100 hover:text-indigo-700"
        >
          <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} />
          <span className="sr-only">更新</span>
        </Button>
      </div>

      {/* メッセージリスト */}
      <div
        className="flex-1 space-y-4 overflow-y-auto rounded-lg bg-gradient-to-br from-white to-slate-50 p-4"
        style={{
          maxHeight: "450px",
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(226, 232, 240, 0.4) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* メッセージがない場合 */}
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-8 text-center shadow-sm">
            <div className="mb-4 rounded-full bg-indigo-50 p-4">
              <MessageSquare className="h-8 w-8 text-indigo-400" />
            </div>
            <p className="font-medium text-slate-600">質問はまだありません</p>
            <p className="mt-2 text-sm text-slate-500">{isSeller ? "質問に回答しましょう" : "最初の質問をしてみましょう"}</p>
          </div>
        ) : (
          // メッセージがある場合
          <AnimatePresence>
            {sortedGroupKeys.map((groupKey) => {
              const groupMessages = groupedMessages[groupKey];
              const isOwnMessage = groupKey === "self";

              // 送信者情報を取得（最初のメッセージから）
              const senderInfo = isOwnMessage
                ? { name: "あなた", image: null }
                : {
                    name: groupMessages[0].sender.name ?? "不明なユーザー",
                    image: groupMessages[0].sender.image,
                  };

              // 出品者かどうか
              const isSellerMessage = groupMessages[0].senderId === sellerId;

              return (
                <motion.div
                  key={groupKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("mb-6 flex w-full flex-col rounded-lg p-3", isOwnMessage ? "items-end" : "items-start")}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {!isOwnMessage && (
                      <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                        <AvatarImage src={senderInfo.image ?? ""} />
                        <AvatarFallback
                          className={cn("text-xs font-bold", isSellerMessage ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600")}
                        >
                          {senderInfo.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col">
                      {/* 送信者名 */}
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isOwnMessage ? "text-indigo-700" : isSellerMessage ? "text-emerald-700" : "text-slate-700",
                        )}
                      >
                        {senderInfo.name}
                      </span>
                      {/* 出品者かどうか */}
                      {isSellerMessage ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700">
                          出品者
                        </Badge>
                      ) : isOwnMessage ? (
                        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-xs text-indigo-700">
                          あなた
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-700">
                          質問者
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="w-full max-w-[90%] space-y-2">
                    {groupMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "relative mb-1 rounded-2xl px-4 py-3 shadow-sm",
                          isOwnMessage
                            ? "ml-auto rounded-tr-none bg-indigo-500 text-white"
                            : isSellerMessage
                              ? "mr-auto rounded-tl-none border border-emerald-100 bg-emerald-50 text-slate-800"
                              : "mr-auto rounded-tl-none border border-slate-100 bg-white text-slate-800",
                        )}
                      >
                        {/* メッセージ内容 */}
                        <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                        {/* メッセージの作成日時 */}
                        <p className={cn("mt-1 text-right text-xs", isOwnMessage ? "text-indigo-100" : "text-slate-500")}>
                          {formatRelativeTime(new Date(msg.createdAt))}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* メッセージ入力フォーム */}
      <Card className="rounded-xl border border-slate-100 bg-white p-4 shadow-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Textarea
                      placeholder={isSeller ? "質問への回答を入力してください..." : "質問を入力してください..."}
                      {...field}
                      disabled={submitting}
                      className="min-h-[100px] resize-none rounded-lg p-3 text-slate-700 shadow-inner focus-visible:border-indigo-400 focus-visible:ring-indigo-400"
                      onKeyDown={handleKeyDown}
                    />
                  </FormControl>
                  <FormMessage className="mt-1 text-xs text-red-500" />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center rounded-md bg-slate-100 px-2 py-1">
                <p className="text-xs font-medium text-slate-600">⌘+Enter</p>
                <p className="ml-1 text-xs text-slate-500">で送信</p>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors duration-200 hover:bg-indigo-700"
              >
                {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <SendHorizonal className="mr-1 h-4 w-4" />}
                送信
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
});
