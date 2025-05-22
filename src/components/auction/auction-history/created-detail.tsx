"use client";

import Image from "next/image";
import { notFound } from "next/navigation";
import { AuctionQA } from "@/components/auction/common/auction-qa";
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
import { TaskStatus } from "@prisma/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Edit, History, Info, MessageSquare } from "lucide-react";

import { QARating } from "../common/auction-rating";
import { TaskStatusBadge } from "../common/status-badge";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細画面コンポーネント
 * @param auctionId 出品商品のID
 */
export function AuctionCreatedDetail({ auctionId }: { auctionId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細の初期情報を取得
   */
  const {
    // state
    auction,
    isLoading,
    deliveryMethod,
    isEditingDelivery,
    isUpdatingDelivery,
    isCompleting,
    tab,

    // functions
    handleComplete,
    setDeliveryMethod,
    handleUpdateDeliveryMethod,
    cancelEditingDelivery,
    startEditingDelivery,
    setTab,
  } = useCreatedDetail(auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中
   */
  if (isLoading) {
    console.log("src/components/auction/auction-history/created-detail.tsx_isLoading", isLoading);
    return <Loading />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品が見つからない
   */
  if (!auction) {
    console.log("src/components/auction/auction-history/created-detail.tsx_auction", auction);
    notFound();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品詳細画面
   */
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">＜出品履歴＞ {auction.task.task}</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid w-full grid-cols-4">
          <TabsTrigger value="info">
            <Info className="mr-2 h-4 w-4" /> 出品情報
          </TabsTrigger>
          <TabsTrigger value="bids">
            <History className="mr-2 h-4 w-4" /> 入札履歴
          </TabsTrigger>
          <TabsTrigger value="chat-before-end" disabled={!auction.winner}>
            <MessageSquare className="mr-2 h-4 w-4" /> メッセージ(出品中)
          </TabsTrigger>
          <TabsTrigger value="chat-after-end" disabled={!auction.winner}>
            <MessageSquare className="mr-2 h-4 w-4" /> メッセージ(落札後)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="container mx-auto">
            {/* 商品情報と落札者情報と評価 */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* 左側: 商品情報 */}
              <div className="md:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">オークション情報</CardTitle>
                    <CardDescription className="flex items-center gap-2">
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
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-lg font-medium">提供方法</h3>
                          {!isEditingDelivery && auction.task.status !== TaskStatus.SUPPLIER_DONE && (
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
                  {auction.winner && auction.task.status !== TaskStatus.SUPPLIER_DONE && (
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
                  {auction.winner && auction.task.status === TaskStatus.SUPPLIER_DONE && (
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
                    <QARating auctionId={auctionId} text="出品画面" />
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">落札状況</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {auction.task.status === "AUCTION_ENDED" ? (
                        <div className="py-4 text-center text-gray-500">落札者はいません</div>
                      ) : (
                        <div className="py-4 text-center text-gray-500">オークションはまだ終了していません</div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="bids">
          <Card>
            <CardHeader>
              <CardTitle>入札履歴</CardTitle>
              <CardDescription>このオークションの出品情報です</CardDescription>
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
                            {auction.winner?.id === bid.user.id && (
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

        <TabsContent value="chat-before-end">
          <AuctionQA
            auctionId={auction.id}
            isDisplayAfterEnd={false}
            auctionEndDate={auction.endTime}
            isEnd={
              auction.task.status === TaskStatus.AUCTION_ENDED ||
              auction.task.status === TaskStatus.SUPPLIER_DONE ||
              auction.task.status === TaskStatus.TASK_COMPLETED ||
              auction.task.status === TaskStatus.FIXED_EVALUATED ||
              auction.task.status === TaskStatus.POINTS_AWARDED ||
              auction.task.status === TaskStatus.POINTS_DEPOSITED
            }
          />
        </TabsContent>

        <TabsContent value="chat-after-end">
          <AuctionQA
            auctionId={auction.id}
            isDisplayAfterEnd={true}
            auctionEndDate={auction.endTime}
            isEnd={
              auction.task.status === TaskStatus.AUCTION_ENDED ||
              auction.task.status === TaskStatus.SUPPLIER_DONE ||
              auction.task.status === TaskStatus.TASK_COMPLETED ||
              auction.task.status === TaskStatus.FIXED_EVALUATED ||
              auction.task.status === TaskStatus.POINTS_AWARDED ||
              auction.task.status === TaskStatus.POINTS_DEPOSITED
            }
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
