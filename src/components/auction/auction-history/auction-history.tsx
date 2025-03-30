"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rating } from "@/components/auction/common/rating";
import { AuctionStatusBadge, BidStatusBadge, TaskStatusBadge } from "@/components/auction/common/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserBidHistory, getUserCreatedAuctions, getUserWonAuctions } from "@/lib/auction/action/history";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/lib/auction/type/types";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Award, Clock, Loader2, Tag } from "lucide-react";

export function AuctionHistory() {
  const router = useRouter();
  const [bidHistory, setBidHistory] = useState<BidHistoryItem[]>([]);
  const [wonAuctions, setWonAuctions] = useState<WonAuctionItem[]>([]);
  const [createdAuctions, setCreatedAuctions] = useState<CreatedAuctionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // タブ切り替え時のデータ取得
  const handleTabChange = async (value: string) => {
    setLoading(true);

    try {
      switch (value) {
        case "bids":
          if (bidHistory.length === 0) {
            const bids = await getUserBidHistory();
            setBidHistory(bids);
          }
          break;
        case "won":
          if (wonAuctions.length === 0) {
            const won = await getUserWonAuctions();
            setWonAuctions(won);
          }
          break;
        case "created":
          if (createdAuctions.length === 0) {
            const created = await getUserCreatedAuctions();
            setCreatedAuctions(created);
          }
          break;
      }
    } catch (error) {
      console.error("データの取得に失敗しました", error);
    } finally {
      setLoading(false);
    }
  };

  // 初期データの取得
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const bids = await getUserBidHistory();
        setBidHistory(bids);
      } catch (error) {
        console.error("入札履歴の取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    };

    // void演算子を使用してPromiseを適切に処理
    void fetchInitialData();
  }, []);

  // 商品詳細画面に遷移
  const handleItemClick = (id: string) => {
    router.push(`/dashboard/auction/${id}`);
  };

  // 落札商品詳細画面に遷移
  const handleWonItemClick = (id: string) => {
    router.push(`/dashboard/auction/won/${id}`);
  };

  // 出品商品詳細画面に遷移
  const handleCreatedItemClick = (id: string) => {
    router.push(`/dashboard/auction/created/${id}`);
  };

  return (
    <div className="container mx-auto py-6">
      <Tabs defaultValue="bids" onValueChange={handleTabChange}>
        <TabsList className="mb-8 grid w-full grid-cols-3">
          <TabsTrigger value="bids">入札履歴</TabsTrigger>
          <TabsTrigger value="won">落札履歴</TabsTrigger>
          <TabsTrigger value="created">出品履歴</TabsTrigger>
        </TabsList>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}

        {/* 入札履歴 */}
        <TabsContent value="bids">
          {!loading && bidHistory.length === 0 && <div className="py-10 text-center text-gray-500">入札履歴はありません</div>}

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
