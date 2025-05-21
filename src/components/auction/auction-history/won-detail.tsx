"use client";

import { memo } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWonDetail } from "@/hooks/auction/history/use-won-detail";
import { AuctionStatus } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertTriangle, ArrowLeft, Award, Calendar, Clock, Loader2, MessageSquare, ShoppingBag } from "lucide-react";

import { AuctionQA } from "../common/auction-qa";
import { QARating } from "../common/auction-rating";
import { TaskStatusBadge } from "../common/status-badge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細画面コンポーネント
 * @param auction 落札商品の詳細情報
 * @param sellerRating 出品者の評価
 * @param sellerReviews 出品者の評価履歴
 */
export const AuctionWonDetail = memo(function AuctionWonDetail({ auctionId }: { auctionId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を取得
   */
  const {
    // state
    auction,
    isLoading,
    error,
    isCompleting,
    router,

    // function
    handleComplete,
  } = useWonDetail(auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を取得中
   */
  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-10rem)] items-center justify-center py-6">
        <Loader2 className="text-primary h-16 w-16 animate-spin" />
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を取得中にエラーが発生した場合
   */
  if (error || !auction) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center py-6">
        <AlertTriangle className="text-destructive h-16 w-16" />
        <p className="text-destructive mt-4 text-lg">
          {error ? `エラーが発生しました: ${error.message}` : "オークション情報を取得できませんでした。"}
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push("/dashboard/auction/history")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 履歴一覧に戻る
        </Button>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を表示
   */
  return (
    <div className="container mx-auto py-6">
      {/* 履歴一覧に戻るボタン */}
      <Button variant="outline" className="mb-6" onClick={() => router.push("/dashboard/auction/history")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> 履歴一覧に戻る
      </Button>

      {/* 商品情報と出品者情報を表示するカード */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* 左側: 商品情報 */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{auction.taskName}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <TaskStatusBadge status={auction.taskStatus} />
                <span className="text-sm">落札日: {format(new Date(auction.auctionEndTime), "yyyy年MM月dd日", { locale: ja })}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-lg font-medium">商品説明</h3>
                  <p className="whitespace-pre-wrap text-gray-700">{auction.taskDetail ?? "商品詳細はありません"}</p>
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
                      <p className="font-medium">
                        {format(
                          new Date(new Date(auction.auctionEndTime).setMonth(new Date(auction.auctionEndTime).getMonth() + 2)),
                          "yyyy年MM月dd日",
                          {
                            locale: ja,
                          },
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {auction.taskDeliveryMethod && (
                  <div>
                    <h3 className="mb-2 text-lg font-medium">提供方法</h3>
                    <p className="text-gray-700">{auction.taskDeliveryMethod}</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" disabled={auction.taskStatus === "TASK_COMPLETED" || isCompleting}>
                    {isCompleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        処理中...
                      </>
                    ) : auction.taskStatus === "TASK_COMPLETED" ? (
                      <>完了済み</>
                    ) : (
                      <>商品受け取りを完了する</>
                    )}
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
          {/* QARatingで出品者情報・評価・送信をまとめて表示 */}
          <QARating auctionId={auctionId} text="落札画面" />
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
                        <p>{format(new Date(auction.auctionStartTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">終了日時</p>
                        <p>{format(new Date(auction.auctionEndTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">落札額</p>
                        <p>{auction.currentHighestBid.toLocaleString()} ポイント</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ステータス</p>
                        <p>
                          <TaskStatusBadge status={auction.taskStatus} />
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
                      <p className="text-sm text-gray-500">{format(new Date(auction.auctionEndTime), "yyyy年MM月dd日 HH:mm", { locale: ja })}</p>
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
                      <p className="text-sm text-gray-500">
                        {format(
                          new Date(new Date(auction.auctionEndTime).setMonth(new Date(auction.auctionEndTime).getMonth() + 2)),
                          "yyyy年MM月dd日",
                          {
                            locale: ja,
                          },
                        )}
                      </p>
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
                <AuctionQA
                  auctionId={auctionId}
                  isDisplayAfterEnd={true}
                  isEnd={auction.auctionStatus === AuctionStatus.ENDED}
                  auctionEndDate={auction.auctionEndTime}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});
