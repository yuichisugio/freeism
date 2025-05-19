"use client";

import { useMemo } from "react";
import Image from "next/image";
import { notFound, useRouter } from "next/navigation";
import { Loading } from "@/components/share/loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreatedDetail } from "@/hooks/auction/history/use-created-detail";
import { ReviewPosition } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Edit, History, MessageSquare, Send } from "lucide-react";
import { useSession } from "next-auth/react";

import { Rating } from "../common/rating";
import { AuctionStatusBadge, TaskStatusBadge } from "../common/status-badge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細画面コンポーネント
 * @param auctionId 出品商品のID
 */
export function AuctionHistoryCreatedDetail({ auctionId }: { auctionId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const { data: session } = useSession();
  const userId = useMemo(() => {
    return session?.user?.id;
  }, [session?.user?.id]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細の初期情報を取得
   */
  const {
    // state
    auction,
    winnerRating,
    winnerReviewCount,
    isLoading,
    messages,
    newMessage,
    isLoadingMessages,
    isSendingMessage,
    messagesEndRef,
    deliveryMethod,
    isEditingDelivery,
    isUpdatingDelivery,
    rating,
    comment,
    isSubmittingReview,
    hasReviewed,
    isCompleting,

    // functions
    setNewMessage,
    handleComplete,
    setDeliveryMethod,
    handleUpdateDeliveryMethod,
    cancelEditingDelivery,
    startEditingDelivery,
    setRating,
    setComment,
    handleReviewSubmit,
    handleSendMessage,
  } = useCreatedDetail(auctionId, userId ?? "");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中
   */
  if (isLoading) {
    return <Loading />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品が見つからない
   */
  if (!auction) {
    notFound();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細画面
   */
  return (
    <div className="container mx-auto py-6">
      {/* 履歴一覧に戻るボタン */}
      <Button variant="outline" className="mb-6" onClick={() => router.push("/dashboard/auction/history")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> 履歴一覧に戻る
      </Button>

      {/* 商品情報と落札者情報と評価 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* 左側: 商品情報 */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{auction.task.task}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <AuctionStatusBadge status={auction.status} />
                <TaskStatusBadge status={auction.task.status} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auction.task.imageUrl && (
                <div className="relative mb-6 h-64 w-full">
                  <Image src={auction.task.imageUrl} alt={auction.task.task} fill className="rounded-lg object-contain" />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-lg font-medium">商品説明</h3>
                  <p className="whitespace-pre-wrap text-gray-700">{auction.task.detail ?? "商品詳細はありません"}</p>
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-medium">オークション情報</h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-gray-500">現在/落札額</p>
                      <p className="text-lg font-bold">{auction.currentHighestBid.toLocaleString()} ポイント</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">開始日時</p>
                      <p>{format(new Date(auction.startTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">終了日時</p>
                      <p>{format(new Date(auction.endTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ステータス</p>
                      <p>
                        <AuctionStatusBadge status={auction.status} />
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-medium">提供方法</h3>
                    {!isEditingDelivery && auction.task.status !== "TASK_COMPLETED" && (
                      <Button variant="outline" size="sm" onClick={startEditingDelivery} disabled={!auction.task.id}>
                        <Edit className="mr-1 h-4 w-4" /> 編集
                      </Button>
                    )}
                  </div>

                  {isEditingDelivery ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="提供方法を入力（例：Amazonのほしい物リストで送付、直接お渡しなど）"
                        value={deliveryMethod}
                        onChange={(e) => setDeliveryMethod(e.target.value)}
                        className="h-24"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditingDelivery}>
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void handleUpdateDeliveryMethod(deliveryMethod)}
                          disabled={isUpdatingDelivery || !deliveryMethod.trim()}
                        >
                          {isUpdatingDelivery ? "更新中..." : "更新する"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-gray-700">{auction.task.deliveryMethod ?? "未設定"}</p>
                  )}
                </div>
              </div>
            </CardContent>
            {auction.winner && auction.task.status !== "TASK_COMPLETED" && (
              <CardFooter>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={isCompleting || !auction.task.id}>
                      {isCompleting ? <>処理中...</> : <>商品提供を完了する</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>商品提供の完了</AlertDialogTitle>
                      <AlertDialogDescription>商品の提供を完了しましたか？この操作は取り消せません。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void handleComplete()}>完了する</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            )}
            {auction.winner && auction.task.status === "TASK_COMPLETED" && (
              <CardFooter>
                <Button className="w-full" disabled={true}>
                  完了済み
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <div>
          {auction.winner ? (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">落札者情報</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={auction.winner.image ?? ""} alt={auction.winner.name ?? "落札者"} />
                      <AvatarFallback>{auction.winner.name?.[0] ?? "落"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{auction.winner.name ?? "落札者"}</p>
                      <div className="flex items-center gap-2">
                        <Rating rating={winnerRating} size={16} />
                        <span className="text-sm text-gray-500">({winnerReviewCount})</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">落札者の評価</CardTitle>
                </CardHeader>
                <CardContent>
                  {hasReviewed ? (
                    <div className="py-4 text-center">
                      <p className="mb-2 text-gray-500">評価済みです</p>
                      <div className="flex justify-center">
                        <Rating
                          rating={
                            (auction.reviews?.reduce((acc, r) => (r.reviewPosition === ReviewPosition.SELLER_TO_BUYER ? acc + r.rating : acc), 0) ??
                              0) / (auction.reviews?.length || 1)
                          }
                          size={24}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="mb-2 text-sm text-gray-500">評価を選択してください</p>
                        <div className="flex justify-center">
                          <Rating rating={rating} size={28} readonly={false} onChange={setRating} />
                        </div>
                      </div>

                      <Textarea placeholder="コメントを入力（任意）" value={comment} onChange={(e) => setComment(e.target.value)} className="h-24" />

                      <Button
                        className="w-full"
                        onClick={() => void handleReviewSubmit()}
                        disabled={rating === 0 || isSubmittingReview || !auction.winnerId || !auction.task?.creatorId}
                      >
                        {isSubmittingReview ? "送信中..." : "評価を送信"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">落札状況</CardTitle>
              </CardHeader>
              <CardContent>
                {auction.status === "ENDED" ? (
                  <div className="py-4 text-center text-gray-500">落札者はいません</div>
                ) : (
                  <div className="py-4 text-center text-gray-500">オークションはまだ終了していません</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-8">
        <Tabs defaultValue="bids">
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="bids">
              <History className="mr-2 h-4 w-4" /> 入札履歴
            </TabsTrigger>
            <TabsTrigger value="chat" disabled={!auction.winner}>
              <MessageSquare className="mr-2 h-4 w-4" /> メッセージ
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bids">
            <Card>
              <CardHeader>
                <CardTitle>入札履歴</CardTitle>
                <CardDescription>このオークションの入札履歴です</CardDescription>
              </CardHeader>
              <CardContent>
                {auction.bidHistories.length === 0 ? (
                  <div className="py-4 text-center text-gray-500">まだ入札はありません</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>入札者</TableHead>
                        <TableHead>入札額</TableHead>
                        <TableHead>入札方法</TableHead>
                        <TableHead className="text-right">入札日時</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auction.bidHistories.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={bid.user.image ?? ""} alt={bid.user.name ?? "入札者"} />
                                <AvatarFallback>{bid.user.name?.[0] ?? "入"}</AvatarFallback>
                              </Avatar>
                              <span>{bid.user.name ?? "入札者"}</span>
                              {auction.winnerId === bid.user.id && (
                                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">落札者</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{bid.amount.toLocaleString()} ポイント</TableCell>
                          <TableCell>{bid.isAutoBid ? "自動入札" : "通常入札"}</TableCell>
                          <TableCell className="text-right">{format(new Date(bid.createdAt), "yyyy/MM/dd HH:mm", { locale: ja })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle>メッセージ</CardTitle>
                <CardDescription>落札者とのメッセージのやり取り</CardDescription>
              </CardHeader>
              <CardContent>
                {!auction.winner ? (
                  <div className="py-8 text-center text-gray-500">落札者がいないためメッセージ機能は利用できません</div>
                ) : (
                  <div className="flex h-[400px] flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto p-4">
                      {isLoadingMessages ? (
                        <div className="flex h-full items-center justify-center">
                          <p className="text-gray-500">メッセージを読み込み中...</p>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                          <p className="text-gray-500">まだメッセージはありません</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div key={msg.id} className={`flex ${msg.senderId === auction.task?.creatorId ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.senderId === auction.task?.creatorId ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={msg.sender.image ?? ""} alt={msg.sender.name ?? "ユーザー"} />
                                  <AvatarFallback>{msg.sender.name?.[0] ?? "U"}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{msg.sender.name ?? "ユーザー"}</span>
                              </div>
                              <p className="mt-1 break-words whitespace-pre-wrap">{msg.message}</p>
                              <p className="mt-1 text-right text-xs opacity-70">{format(new Date(msg.createdAt), "MM/dd HH:mm", { locale: ja })}</p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t p-4">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="メッセージを入力..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="min-h-[80px]"
                          disabled={!auction.winner}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.ctrlKey) {
                              e.preventDefault();
                              void handleSendMessage(newMessage);
                            }
                          }}
                        />
                        <Button
                          className="h-auto"
                          onClick={() => void handleSendMessage(newMessage)}
                          disabled={isSendingMessage || !newMessage.trim() || !auction.winner}
                        >
                          {isSendingMessage ? (
                            "送信中..."
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              送信
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">Ctrl + Enterで送信できます</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
