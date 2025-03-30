"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import { completeTaskDelivery, createAuctionReview, updateDeliveryMethod } from "@/lib/auction/action/history";
import { type Auction, type AuctionReview, type AuctionStatus, type TaskStatus } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Edit, History, MessageSquare, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Rating } from "../common/rating";
import { AuctionStatusBadge, TaskStatusBadge } from "../common/status-badge";

type BidHistory = {
  id: string;
  amount: number;
  createdAt: Date | string;
  isAutoBid?: boolean;
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
};

type AuctionCreatedDetailProps = {
  auction: Auction & {
    task: {
      id: string;
      task: string;
      detail?: string | null;
      status: TaskStatus;
      imageUrl?: string | null;
      creatorId: string;
      deliveryMethod?: string | null;
    };
    winner?: {
      id: string;
      name?: string | null;
      image?: string | null;
    } | null;
    reviews: AuctionReview[];
    bidHistories: BidHistory[];
    currentHighestBid: number;
    status: AuctionStatus;
    startTime: Date;
    endTime: Date;
  };
  winnerRating: number;
  winnerReviews: AuctionReview[];
};

export function AuctionCreatedDetail({ auction, winnerRating, winnerReviews }: AuctionCreatedDetailProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState(auction.task.deliveryMethod ?? "");
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // ユーザーがすでに評価を送信したかどうか
  const hasReviewed = auction.reviews.some((review: AuctionReview) => review.reviewerId === auction.task.creatorId && review.isSellerReview);

  const handleReviewSubmit = async () => {
    if (!auction.winner) {
      toast.error("落札者がいないため評価できません");
      return;
    }

    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAuctionReview(
        auction.id,
        auction.winner.id,
        rating,
        comment,
        true, // 出品者からの評価なのでtrue
      );
      toast.success("評価を送信しました");
      router.refresh();
    } catch (error) {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await completeTaskDelivery(auction.task.id);
      toast.success("商品の提供を完了しました");
      router.refresh();
    } catch (error) {
      console.error("完了処理に失敗しました", error);
      toast.error("完了処理に失敗しました");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleUpdateDeliveryMethod = async () => {
    if (!deliveryMethod.trim()) {
      toast.error("提供方法を入力してください");
      return;
    }

    setIsUpdatingDelivery(true);
    try {
      await updateDeliveryMethod(auction.task.id, deliveryMethod);
      toast.success("提供方法を更新しました");
      setIsEditingDelivery(false);
      router.refresh();
    } catch (error) {
      console.error("提供方法の更新に失敗しました", error);
      toast.error("提供方法の更新に失敗しました");
    } finally {
      setIsUpdatingDelivery(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Button variant="outline" className="mb-6" onClick={() => router.push("/dashboard/auction/mine")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> 履歴一覧に戻る
      </Button>

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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">現在/落札額</p>
                      <p className="text-lg font-bold">{auction.currentHighestBid.toLocaleString()} ポイント</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">オークション期間</p>
                      <p className="font-medium">
                        {format(new Date(auction.startTime), "yyyy/MM/dd", { locale: ja })} 〜 {format(new Date(auction.endTime), "yyyy/MM/dd", { locale: ja })}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-medium">提供方法</h3>
                    {!isEditingDelivery && (
                      <Button variant="outline" size="sm" onClick={() => setIsEditingDelivery(true)}>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditingDelivery(false);
                            setDeliveryMethod(auction.task.deliveryMethod ?? "");
                          }}
                        >
                          キャンセル
                        </Button>
                        <Button size="sm" onClick={handleUpdateDeliveryMethod} disabled={isUpdatingDelivery}>
                          {isUpdatingDelivery ? "更新中..." : "更新する"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700">{auction.task.deliveryMethod ?? "未設定"}</p>
                  )}
                </div>
              </div>
            </CardContent>
            {auction.winner && (
              <CardFooter>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={auction.task.status === "TASK_COMPLETED" || isCompleting}>
                      {isCompleting ? <>処理中...</> : auction.task.status === "TASK_COMPLETED" ? <>完了済み</> : <>商品提供を完了する</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>商品提供の完了</AlertDialogTitle>
                      <AlertDialogDescription>商品の提供を完了しましたか？この操作は取り消せません。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction onClick={handleComplete}>完了する</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* 右側: 落札者情報と評価 */}
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
                        <span className="text-sm text-gray-500">({winnerReviews.length})</span>
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
                        <Rating rating={auction.reviews.find((r) => r.isSellerReview)?.rating ?? 0} size={24} />
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

                      <Button className="w-full" onClick={handleReviewSubmit} disabled={rating === 0 || isSubmitting}>
                        {isSubmitting ? "送信中..." : "評価を送信"}
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

      {/* タブ付きセクション */}
      <div className="mt-8">
        <Tabs defaultValue="bids">
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="bids">
              <History className="mr-2 h-4 w-4" /> 入札履歴
            </TabsTrigger>
            <TabsTrigger value="details">
              <ShoppingBag className="mr-2 h-4 w-4" /> 詳細情報
            </TabsTrigger>
            <TabsTrigger value="chat">
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
                      {auction.bidHistories.map(
                        (bid: {
                          id: string;
                          amount: number;
                          createdAt: Date | string;
                          isAutoBid?: boolean;
                          user: {
                            id: string;
                            name?: string | null;
                            image?: string | null;
                          };
                        }) => (
                          <TableRow key={bid.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={bid.user.image ?? ""} alt={bid.user.name ?? "入札者"} />
                                  <AvatarFallback>{bid.user.name?.[0] ?? "入"}</AvatarFallback>
                                </Avatar>
                                <span>{bid.user.name ?? "入札者"}</span>
                                {auction.winnerId === bid.user.id && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">落札者</span>}
                              </div>
                            </TableCell>
                            <TableCell>{bid.amount.toLocaleString()} ポイント</TableCell>
                            <TableCell>{bid.isAutoBid ? "自動入札" : "通常入札"}</TableCell>
                            <TableCell className="text-right">{format(new Date(bid.createdAt), "yyyy/MM/dd HH:mm", { locale: ja })}</TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>詳細情報</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">オークション情報</h3>
                    <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-sm text-gray-500">開始日時</p>
                        <p>{format(new Date(auction.startTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">終了日時</p>
                        <p>{format(new Date(auction.endTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">現在/落札額</p>
                        <p>{auction.currentHighestBid.toLocaleString()} ポイント</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ステータス</p>
                        <p>
                          <AuctionStatusBadge status={auction.status} />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
                <div className="py-8 text-center text-gray-500">この機能は現在準備中です</div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
