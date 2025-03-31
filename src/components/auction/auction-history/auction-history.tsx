"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rating } from "@/components/auction/common/rating";
import { AuctionStatusBadge, BidStatusBadge, TaskStatusBadge } from "@/components/auction/common/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserCreatedAuctions, getUserLatestBids, getUserWonAuctions } from "@/lib/auction/action/history";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/lib/auction/type/types";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Award, Clock, Loader2, Tag } from "lucide-react";

/**
 * 入札・落札履歴コンポーネント
 * @returns 入札・落札履歴コンポーネント
 */
export function AuctionHistory() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const router = useRouter();
  const [bidHistory, setBidHistory] = useState<BidHistoryItem[]>([]);
  const [wonAuctions, setWonAuctions] = useState<WonAuctionItem[]>([]);
  const [createdAuctions, setCreatedAuctions] = useState<CreatedAuctionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<string>("bids");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // タブ切り替え時のロジック
  const handleTabChange = useCallback((value: string) => {
    setCurrentTab(value);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // データ更新処理
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // 現在のタブに応じたデータのみを更新
      switch (currentTab) {
        case "bids":
          const bids = await getUserLatestBids();
          setBidHistory(bids);
          break;
        case "won":
          const won = await getUserWonAuctions();
          setWonAuctions(won);
          break;
        case "created":
          const created = await getUserCreatedAuctions();
          setCreatedAuctions(created);
          break;
      }
    } catch (error) {
      console.error("データの更新に失敗しました", error);
    } finally {
      setRefreshing(false);
    }
  }, [currentTab]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 初期データの取得（全データを一度に取得）
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 3つのデータを並列で取得
        const [bids, won, created] = await Promise.all([getUserLatestBids(), getUserWonAuctions(), getUserCreatedAuctions()]);
        // 取得したデータを各ステートにセット
        setBidHistory(bids);
        setWonAuctions(won);
        setCreatedAuctions(created);
      } catch (error) {
        console.error("データの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    };

    // void演算子を使用してPromiseを適切に処理
    void fetchAllData();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 商品詳細画面に遷移
  const handleItemClick = useCallback(
    (id: string) => {
      router.push(`/dashboard/auction/${id}`);
    },
    [router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 落札商品詳細画面に遷移
  const handleWonItemClick = useCallback(
    (id: string) => {
      router.push(`/dashboard/auction/won/${id}`);
    },
    [router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 出品商品詳細画面に遷移
  const handleCreatedItemClick = useCallback(
    (id: string) => {
      router.push(`/dashboard/auction/created/${id}`);
    },
    [router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="container mx-auto py-6">
      {/* タブ */}
      <Tabs defaultValue="bids" onValueChange={handleTabChange}>
        <div className="mb-8 flex items-center justify-between">
          <TabsList className="grid w-full max-w-[500px] grid-cols-3">
            <TabsTrigger value="bids">入札履歴</TabsTrigger>
            <TabsTrigger value="won">落札履歴</TabsTrigger>
            <TabsTrigger value="created">出品履歴</TabsTrigger>
          </TabsList>

          {/* 更新ボタン */}
          <button onClick={handleRefresh} disabled={refreshing || loading} className="flex items-center gap-1 rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-refresh-cw"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            )}
            <span>更新</span>
          </button>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}

        {/* 入札履歴 */}
        <TabsContent value="bids">
          {/* 入札履歴がない場合 */}
          {!loading && bidHistory.length === 0 && <div className="py-10 text-center text-gray-500">入札履歴はありません</div>}

          {/* 入札履歴がある場合 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bidHistory.map((bid) => (
              <Card key={bid.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => handleItemClick(bid.auction.task.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-1 text-lg">{bid.auction.task.task}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>{formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true, locale: ja })}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-gray-500">入札額</div>
                    <div className="text-lg font-semibold">{bid.amount.toLocaleString()} ポイント</div>
                  </div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-gray-500">現在の最高額</div>
                    <div className="font-medium">{bid.auction.currentHighestBid.toLocaleString()} ポイント</div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-0">
                  <BidStatusBadge status={bid.status} />
                  <AuctionStatusBadge status={bid.auction.status} />
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 落札履歴 */}
        <TabsContent value="won">
          {!loading && wonAuctions.length === 0 && <div className="py-10 text-center text-gray-500">落札履歴はありません</div>}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {wonAuctions.map((auction) => (
              <Card key={auction.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => handleWonItemClick(auction.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-1 text-lg">{auction.task.task}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Award size={14} />
                    <span>{formatDistanceToNow(new Date(auction.endTime), { addSuffix: true, locale: ja })}に落札</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-gray-500">落札額</div>
                    <div className="text-lg font-semibold">{auction.currentHighestBid.toLocaleString()} ポイント</div>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={auction.task.creator.image ?? ""} alt={auction.task.creator.name ?? "出品者"} />
                      <AvatarFallback>{auction.task.creator.name?.[0] ?? "出"}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{auction.task.creator.name ?? "出品者"}</span>
                  </div>
                  {auction.task.deliveryMethod && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">提供方法: </span>
                      {auction.task.deliveryMethod}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between pt-0">
                  <TaskStatusBadge status={auction.task.status} />
                  {auction.reviews.length > 0 ? <Rating rating={auction.reviews[0].rating} size={16} /> : <span className="text-xs text-gray-500">未評価</span>}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 出品履歴 */}
        <TabsContent value="created">
          {!loading && createdAuctions.length === 0 && <div className="py-10 text-center text-gray-500">出品履歴はありません</div>}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {createdAuctions.map((auction) => (
              <Card key={auction.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => handleCreatedItemClick(auction.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="line-clamp-1 text-lg">{auction.task.task}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Tag size={14} />
                    <span>{formatDistanceToNow(new Date(auction.createdAt), { addSuffix: true, locale: ja })}に出品</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm text-gray-500">現在/落札額</div>
                    <div className="text-lg font-semibold">{auction.currentHighestBid.toLocaleString()} ポイント</div>
                  </div>
                  {auction.winner && (
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={auction.winner.image ?? ""} alt={auction.winner.name ?? "落札者"} />
                        <AvatarFallback>{auction.winner.name?.[0] ?? "落"}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{auction.winner.name ?? "落札者"}</span>
                    </div>
                  )}
                  {auction.task.deliveryMethod && (
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">提供方法: </span>
                      {auction.task.deliveryMethod}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between pt-0">
                  <TaskStatusBadge status={auction.task.status} />
                  <AuctionStatusBadge status={auction.status} />
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
