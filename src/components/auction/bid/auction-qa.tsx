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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary mr-2 h-6 w-6 animate-spin" />
        <p className="text-muted-foreground">メッセージを読み込み中...</p>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // エラー表示
  if (error) {
    return (
      <div className="border-destructive text-destructive rounded-lg border p-4 text-center">
        <p>{error}</p>
        <Button onClick={handleReload} variant="outline" className="mt-4">
          再読み込み
        </Button>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* メッセージヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-primary h-5 w-5" />
          <h3 className="text-lg font-medium">質問と回答</h3>
          {isSeller && (
            <Badge variant="outline" className="ml-2">
              出品者
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleReload} disabled={reloading} className="h-8 w-8 rounded-full p-0">
          <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} />
          <span className="sr-only">更新</span>
        </Button>
      </div>

      {/* メッセージリスト */}
      <div
        className="flex-1 space-y-4 overflow-y-auto rounded-lg bg-slate-50 p-4"
        style={{
          maxHeight: "400px",
          backgroundImage:
            "linear-gradient(rgba(241, 245, 249, 0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(241, 245, 249, 0.7) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="text-muted-foreground/40 mb-2 h-12 w-12" />
            <p className="text-muted-foreground">質問はまだありません</p>
            <p className="text-muted-foreground/70 text-xs">{isSeller ? "質問に回答しましょう" : "最初の質問をしてみましょう"}</p>
          </div>
        ) : (
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
                  className={cn(
                    "mb-6 flex w-full flex-col rounded-lg p-3",
                    isOwnMessage ? "items-end bg-blue-50/50" : isSellerMessage ? "items-start bg-green-50/50" : "items-start bg-slate-100/50",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {!isOwnMessage && (
                      <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                        <AvatarImage src={senderInfo.image ?? ""} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{senderInfo.name?.charAt(0) ?? "?"}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex flex-col">
                      <span
                        className={cn("text-sm font-medium", isOwnMessage ? "text-blue-700" : isSellerMessage ? "text-green-700" : "text-slate-700")}
                      >
                        {senderInfo.name}
                      </span>
                      {isSellerMessage ? (
                        <Badge variant="outline" className="border-green-200 bg-green-100 text-xs text-green-800">
                          出品者
                        </Badge>
                      ) : isOwnMessage ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-100 text-xs text-blue-800">
                          あなた
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-slate-200 bg-slate-100 text-xs text-slate-800">
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
                          "relative mb-1 rounded-2xl px-4 py-2 shadow-sm",
                          isOwnMessage
                            ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                            : isSellerMessage
                              ? "mr-auto rounded-tl-none bg-green-200 text-green-900"
                              : "bg-muted mr-auto rounded-tl-none text-slate-800",
                        )}
                      >
                        <p className="text-sm break-words">{msg.message}</p>
                        <p className="mt-1 text-right text-xs opacity-70">{formatRelativeTime(new Date(msg.createdAt))}</p>
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
      <Card className="border-none p-3 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
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
                      className="bg-muted min-h-[80px] resize-none rounded-lg border focus-visible:ring-1"
                      onKeyDown={handleKeyDown}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">⌘+Enterで送信</p>
              <Button type="submit" size="sm" disabled={submitting}>
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
