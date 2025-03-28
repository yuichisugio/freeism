"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuctionEvent } from "@/hooks/auction/useAuctionEvent";
import { useCountdown } from "@/hooks/auction/useCountdown";
import { useWatchlistActions } from "@/hooks/auction/useWatchlistActions";
import { DEFAULT_AUCTION_IMAGE_URL } from "@/lib/auction/constants";
import { type Auction, type AuctionWithDetails } from "@/lib/auction/types";
import { formatCurrency } from "@/lib/formatters";
import { Clock, Heart } from "lucide-react";
import { useSession } from "next-auth/react";

import BidForm from "./BidForm";
import BidHistory from "./BidHistory";
import { CountdownDisplay } from "./CountdownDisplay";

/**
 * オークション詳細ページ
 * @param initialAuction オークション情報
 * @returns オークション詳細ページ
 */
export default function AuctionDetail({ initialAuction }: { initialAuction: AuctionWithDetails }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ウォッチリストの状態
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  // 初期フェッチの完了状態
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  // アクティブタブ
  const [activeTab, setActiveTab] = useState("details");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ユーザーIDを取得
  const { data: session } = useSession();
  if (!session || !session.user) {
    notFound();
  }
  const currentUserId = session.user.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useAuctionEventフックを使用してSSEからリアルタイムデータを取得
  const { auction = initialAuction, bidHistory, loading, error, lastReceivedMessage } = useAuctionEvent(initialAuction);

  if (!auction) {
    notFound();
  }

  // カウントダウンの状態
  const { countdownState, countdown } = useCountdown(new Date(auction.endTime || initialAuction.endTime));

  // オークションが終了しているかどうか
  const isAuctionEnded = countdownState.isExpired;

  // ウォッチリストアクション
  const { submitting, toggleWatchlist, getWatchlistStatus } = useWatchlistActions();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストの状態を取得する処理
   */
  useEffect(() => {
    async function checkWatchlistStatus() {
      if (!auction.id) return;

      try {
        const status = await getWatchlistStatus(auction.id);
        setIsWatchlisted(status);
        setInitialFetchDone(true);
      } catch (err) {
        console.error("ウォッチリストの状態取得エラー:", err);
        setInitialFetchDone(true);
      }
    }

    if (!initialFetchDone) {
      checkWatchlistStatus();
    }
  }, [auction.id, getWatchlistStatus, initialFetchDone]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション情報の変更を監視。更新があればコンソールに出力
   */
  useEffect(() => {
    console.log("AuctionDetail_auction_state_updated", auction);
  }, [auction]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札履歴の変更を監視。更新があればコンソールに出力
   */
  useEffect(() => {
    console.log("AuctionDetail_bidHistory_state_updated", bidHistory);
  }, [bidHistory]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリストボタンのクリックハンドラ
   */
  async function handleWatchlistToggle() {
    if (!auction.id) return;
    try {
      const newStatus = await toggleWatchlist(auction.id);
      setIsWatchlisted(newStatus || false);
    } catch (err) {
      console.error("ウォッチリスト更新エラー:", err);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション詳細タブの内容
   */
  function renderDetailsTab() {
    return (
      <div className="space-y-6">
        {/* 現在価格、開始価格、入札数を表示するカード */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">現在価格</p>
                  <p className="text-2xl font-bold">{formatCurrency(auction.currentHighestBid || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">最低入札額</p>
                  <p className="text-2xl font-bold">{formatCurrency(auction.currentHighestBid + 1 || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">入札数</p>
                  <p className="text-2xl font-bold">{bidHistory.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* カウントダウン表示部分 */}
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-muted-foreground" />
            <CountdownDisplay countdownState={countdownState} countdownAction={countdown} />
          </div>

          {/* 自分の出品していないオークションで、オークションが終了していない場合は入札フォームを表示 */}
          {auction.sellerId !== currentUserId && !isAuctionEnded && (
            <BidForm
              auction={
                {
                  id: auction.id,
                  title: auction.title,
                  description: auction.description,
                  currentPrice: auction.currentHighestBid,
                  startTime: auction.startTime.toString(),
                  endTime: auction.endTime.toString(),
                  sellerId: auction.sellerId,
                } as Auction
              }
            />
          )}

          {/* オークションが終了している場合は、終了した旨のメッセージを表示 */}
          {isAuctionEnded && (
            <div className="bg-muted rounded-md border p-4 text-center">
              <p className="font-medium">このオークションは終了しました</p>
            </div>
          )}

          {/* 自分の出品しているオークションの場合は、自分の出品したオークションですというメッセージを表示 */}
          {auction.sellerId === currentUserId && (
            <div className="bg-muted rounded-md border p-4 text-center">
              <p className="font-medium">自分の出品したオークションです</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 質問と回答タブの内容
  function renderQaTab() {
    return (
      <div className="py-4">
        <div className="bg-muted rounded-md border p-8 text-center">
          <p className="text-muted-foreground">現在、質問はありません。</p>
          <Button className="mt-4" variant="outline">
            質問する
          </Button>
        </div>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 配送・支払いタブの内容
  function renderShippingTab() {
    return (
      <div className="space-y-4 py-4">
        <div>
          <h3 className="mb-2 text-lg font-medium">配送方法</h3>
          <p className="text-muted-foreground">出品者と直接調整してください。詳細は落札後に確認できます。</p>
        </div>
        <div>
          <h3 className="mb-2 text-lg font-medium">支払い方法</h3>
          <p className="text-muted-foreground">落札後、自動的にポイントが使用されます。 預けたポイントは、落札から{auction.task.group.depositPeriod}日後に返還されます。</p>
        </div>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ローディング状態の表示
  if (loading) {
    return <div className="p-8 text-center">オークション情報を読み込み中...</div>;
  }

  // エラー状態の表示
  if (error) {
    return <div className="text-destructive p-8 text-center">{error}</div>;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="space-y-6">
      {/* SSEデバッグ情報表示エリア */}
      {lastReceivedMessage && (
        <div className="overflow-x-auto rounded-md bg-slate-100 p-2 font-mono text-xs">
          <p className="mb-1 font-semibold">最後に受信したSSEメッセージ:</p>
          <pre className="break-all whitespace-pre-wrap">{lastReceivedMessage}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 左側: オークション画像 */}
        <div className="relative h-[150px] rounded-lg">
          <Image src={DEFAULT_AUCTION_IMAGE_URL} alt={auction.title || "オークション画像"} fill className="object-cover" priority />
        </div>

        {/* 右側: オークション情報ヘッダー部分 */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between">
              <Button variant="ghost" size="icon" onClick={handleWatchlistToggle} disabled={submitting || auction.sellerId === currentUserId} className={isWatchlisted ? "text-red-500" : ""}>
                <Heart className={isWatchlisted ? "fill-current" : ""} size={20} />
              </Button>
            </div>
            <p className="text-muted-foreground mt-1">{auction.task.creator.name || "不明なユーザー"}</p>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant={isAuctionEnded ? "destructive" : "secondary"}>{isAuctionEnded ? "終了" : "出品中"}</Badge>
            {auction.task.group && (
              <Badge key={auction.task.group.id} variant="outline">
                {auction.task.group.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* タブ切り替え部分 */}
      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 grid grid-cols-4">
          <TabsTrigger value="details">詳細</TabsTrigger>
          <TabsTrigger value="bid-history">入札履歴</TabsTrigger>
          <TabsTrigger value="qa">質問と回答</TabsTrigger>
          <TabsTrigger value="shipping">配送・支払い</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0">
          {renderDetailsTab()}
        </TabsContent>

        <TabsContent value="bid-history" className="mt-0">
          {/* SSEで取得した入札履歴を渡す */}
          {<BidHistory initialBids={bidHistory} />}
        </TabsContent>

        <TabsContent value="qa" className="mt-0">
          {renderQaTab()}
        </TabsContent>

        <TabsContent value="shipping" className="mt-0">
          {renderShippingTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
