"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { completeTaskDelivery, createAuctionReview } from "@/lib/auction/action/history";
import { type Auction, type AuctionReview, type TaskStatus } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, Award, Calendar, Clock, MessageSquare, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Rating } from "../common/rating";
import { TaskStatusBadge } from "../common/status-badge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 落札商品詳細画面コンポーネントのprops
type AuctionWonDetailProps = {
  auction: Auction & {
    task: {
      id: string;
      task: string;
      detail?: string | null;
      status: TaskStatus;
      imageUrl?: string | null;
      creatorId: string;
      deliveryMethod?: string | null;
      creator: {
        id: string;
        name?: string | null;
        image?: string | null;
      };
    };
    winnerId: string;
    reviews: AuctionReview[];
    currentHighestBid: number;
    endTime: Date;
    startTime: Date;
  };
  sellerRating: number;
  sellerReviews: AuctionReview[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細画面コンポーネント
 * @param auction 落札商品の詳細情報
 * @param sellerRating 出品者の評価
 * @param sellerReviews 出品者の評価履歴
 */
export const AuctionWonDetail = memo(function AuctionWonDetail({ auction, sellerRating, sellerReviews }: AuctionWonDetailProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 評価
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ユーザーがすでに評価を送信したかどうか
  const hasReviewed = useMemo(() => auction.reviews.some((review: AuctionReview) => review.reviewerId === auction.winnerId), [auction.reviews, auction.winnerId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 評価を送信する
  const handleReviewSubmit = useCallback(async () => {
    if (rating === 0) {
      toast.error("評価を選択してください");
      return;
    }

    setIsSubmitting(true);
    try {
      await createAuctionReview(
        auction.id,
        auction.task.creatorId,
        rating,
        comment,
        false, // 落札者からの評価なのでfalse
      );
      toast.success("評価を送信しました");
      router.refresh();
    } catch (error) {
      console.error("評価の送信に失敗しました", error);
      toast.error("評価の送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }, [auction.id, auction.task.creatorId, comment, rating, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 商品の受け取りを完了する
  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      await completeTaskDelivery(auction.task.id);
      toast.success("商品の受け取りを完了しました");
      router.refresh();
    } catch (error) {
      console.error("完了処理に失敗しました", error);
      toast.error("完了処理に失敗しました");
    } finally {
      setIsCompleting(false);
    }
  }, [auction.task.id, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 落札商品詳細画面コンポーネント
  return (
    <div className="container mx-auto py-6">
      {/* 履歴一覧に戻るボタン */}
      <Button variant="outline" className="mb-6" onClick={() => router.push("/dashboard/auction/mine")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> 履歴一覧に戻る
      </Button>

      {/* 商品情報と出品者情報を表示するカード */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* 左側: 商品情報 */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{auction.task.task}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <TaskStatusBadge status={auction.task.status} />
                <span className="text-sm">落札日: {format(new Date(auction.endTime), "yyyy年MM月dd日", { locale: ja })}</span>
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
                  <h3 className="mb-2 text-lg font-medium">落札情報</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">落札額</p>
                      <p className="text-lg font-bold">{auction.currentHighestBid.toLocaleString()} ポイント</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">預けるポイント額</p>
                      <p className="text-lg font-bold">{auction.currentHighestBid.toLocaleString()} ポイント</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">ポイント返還日</p>
                      <p className="font-medium">{format(new Date(new Date(auction.endTime).setMonth(new Date(auction.endTime).getMonth() + 2)), "yyyy年MM月dd日", { locale: ja })}</p>
                    </div>
                  </div>
                </div>

                {auction.task.deliveryMethod && (
                  <div>
                    <h3 className="mb-2 text-lg font-medium">提供方法</h3>
                    <p className="text-gray-700">{auction.task.deliveryMethod}</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" disabled={auction.task.status === "TASK_COMPLETED" || isCompleting}>
                    {isCompleting ? <>処理中...</> : auction.task.status === "TASK_COMPLETED" ? <>完了済み</> : <>商品受け取りを完了する</>}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>商品受け取りの完了</AlertDialogTitle>
                    <AlertDialogDescription>商品を受け取り、取引を完了しますか？この操作は取り消せません。</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={handleComplete}>完了する</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </div>

        {/* 右側: 出品者情報と評価 */}
        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">出品者情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={auction.task.creator.image ?? ""} alt={auction.task.creator.name ?? "出品者"} />
                  <AvatarFallback>{auction.task.creator.name?.[0] ?? "出"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{auction.task.creator.name ?? "出品者"}</p>
                  <div className="flex items-center gap-2">
                    <Rating rating={sellerRating} size={16} />
                    <span className="text-sm text-gray-500">({sellerReviews.length})</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">出品者の評価</CardTitle>
            </CardHeader>
            <CardContent>
              {hasReviewed ? (
                <div>
                  <div className="mb-4">
                    {auction.reviews.map(
                      (review: AuctionReview) =>
                        review.reviewerId === auction.winnerId && (
                          <div key={review.id} className="space-y-2">
                            <Rating rating={review.rating} size={20} />
                            <p className="text-gray-700">{review.comment ?? "コメントなし"}</p>
                          </div>
                        ),
                    )}
                  </div>
                  <div className="text-center text-green-600">評価を送信済みです</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 text-sm text-gray-500">評価を選択</div>
                    <Rating rating={rating} onChange={setRating} size={24} readonly={false} />
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-gray-500">コメント (任意)</div>
                    <Textarea placeholder="評価コメントを入力してください" value={comment} onChange={(e) => setComment(e.target.value)} className="h-24" />
                  </div>
                  <div className="text-right">
                    <Button onClick={handleReviewSubmit} disabled={isSubmitting || rating === 0}>
                      {isSubmitting ? "送信中..." : "評価を送信する"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* タブ付きセクション */}
      <div className="mt-8">
        <Tabs defaultValue="details">
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="details">
              <ShoppingBag className="mr-2 h-4 w-4" /> 詳細情報
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <Calendar className="mr-2 h-4 w-4" /> タイムライン
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="mr-2 h-4 w-4" /> メッセージ
            </TabsTrigger>
          </TabsList>

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
                        <p className="text-sm text-gray-500">落札額</p>
                        <p>{auction.currentHighestBid.toLocaleString()} ポイント</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ステータス</p>
                        <p>
                          <TaskStatusBadge status={auction.task.status} />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* タイムライン */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>タイムライン</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex">
                    <div className="mr-4 flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Award className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="mt-2 h-full w-px bg-gray-200" />
                    </div>
                    <div>
                      <p className="font-medium">オークション終了・落札</p>
                      <p className="text-sm text-gray-500">{format(new Date(auction.endTime), "yyyy年MM月dd日 HH:mm", { locale: ja })}</p>
                    </div>
                  </div>

                  <div className="flex">
                    <div className="mr-4 flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                        <Clock className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium">ポイント返還予定日</p>
                      <p className="text-sm text-gray-500">{format(new Date(new Date(auction.endTime).setMonth(new Date(auction.endTime).getMonth() + 2)), "yyyy年MM月dd日", { locale: ja })}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* メッセージ */}
          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle>メッセージ</CardTitle>
                <CardDescription>出品者とのメッセージのやり取り</CardDescription>
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
});
