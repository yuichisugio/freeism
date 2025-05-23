"use client";

import { memo } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Error } from "@/components/share/share-error";
import { Loading } from "@/components/share/share-loading";
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
import { TaskStatus } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Award, Calendar, Clock, Info, Loader2, MessageSquare } from "lucide-react";

import { AuctionQA } from "../common/auction-qa";
import { QARating } from "../common/auction-rating";
import { TaskStatusBadge } from "../common/status-badge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札商品詳細画面コンポーネント
 * @param auctionId 落札商品のID
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
    tab,

    // function
    handleComplete,
    setTab,
  } = useWonDetail(auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を取得中
   */
  if (isLoading) {
    return <Loading />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報が見つからない
   */
  if (!auction) {
    notFound();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を取得中にエラーが発生した場合
   */
  if (error) {
    return <Error error={error} previousPageURL="/dashboard/auction/history?tab=won" />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札商品の詳細情報を表示
   */
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">＜落札履歴＞ {auction.taskName}</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="info">
            <Info className="mr-2 h-4 w-4" /> 商品情報
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Calendar className="mr-2 h-4 w-4" /> タイムライン
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="mr-2 h-4 w-4" /> メッセージ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="container mx-auto">
            {/* 商品情報と出品者情報 */}
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
                    {auction.taskImageUrl && (
                      <div className="relative mb-6 h-64 w-full">
                        <Image src={auction.taskImageUrl} alt={auction.taskName} fill className="rounded-lg object-contain" />
                      </div>
                    )}

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
                            <p className="text-sm text-gray-500">開始日時</p>
                            <p>{format(new Date(auction.auctionStartTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">終了日時</p>
                            <p>{format(new Date(auction.auctionEndTime), "yyyy/MM/dd HH:mm", { locale: ja })}</p>
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
                          <p className="whitespace-pre-wrap text-gray-700">{auction.taskDeliveryMethod}</p>
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
                <QARating auctionId={auctionId} text="落札画面" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>タイムライン</CardTitle>
              <CardDescription>このオークションの経過</CardDescription>
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

        <TabsContent value="chat">
          <AuctionQA
            auctionId={auctionId}
            isDisplayAfterEnd={true}
            isEnd={
              auction.taskStatus === TaskStatus.AUCTION_ENDED ||
              auction.taskStatus === TaskStatus.SUPPLIER_DONE ||
              auction.taskStatus === TaskStatus.POINTS_DEPOSITED ||
              auction.taskStatus === TaskStatus.TASK_COMPLETED ||
              auction.taskStatus === TaskStatus.FIXED_EVALUATED ||
              auction.taskStatus === TaskStatus.POINTS_AWARDED
            }
            auctionEndDate={auction.auctionEndTime}
          />
        </TabsContent>
      </Tabs>
    </>
  );
});
