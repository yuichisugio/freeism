"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuctionEvent } from "@/hooks/auction/bid/use-auction-event";
import { useCountdown } from "@/hooks/auction/bid/use-countdown";
import { useWatchlist } from "@/hooks/auction/bid/use-watchlist";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { type AuctionWithDetails } from "@/types/auction-types";
import { AuctionStatus } from "@prisma/client";
import { motion } from "framer-motion";
import { AlertTriangle, BarChart, Heart, Info, MessageSquare, ShoppingBag, TruckIcon, User } from "lucide-react";
import { useSession } from "next-auth/react";

import { CountdownDisplay } from "./auction-bid-countdown";
import { AuctionQA } from "./auction-qa";
import { BidForm } from "./bid-form";
import { BidHistory } from "./bid-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ローディングインジケーター
 */
export const LoadingIndicator = memo(function LoadingIndicator() {
  console.log("src/components/auction/bid/auction-detail.tsx_LoadingIndicator_render");

  return (
    <div className="flex items-center justify-center p-12">
      {/* 中央揃えのためのコンテナ */}
      <div className="text-center">
        {/* スピナーアイコン (Tailwind CSS アニメーション) */}
        <div className="border-primary inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent align-[-0.125em]"></div>
        {/* ローディングメッセージ */}
        <p className="text-muted-foreground mt-4">オークション情報を読み込み中...</p>
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エラーインジケーター
 */
export const ErrorIndicator = memo(function ErrorIndicator({ error }: { error: string }) {
  console.log("src/components/auction/bid/auction-detail.tsx_ErrorIndicator_render");

  return (
    <div className="border-destructive rounded-lg border p-6 text-center">
      <AlertTriangle className="text-destructive mx-auto mb-3 h-8 w-8" />
      <p className="text-destructive">{error}</p>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション詳細ページ
 * @param initialAuction オークション情報
 * @returns オークション詳細ページ
 */
export const AuctionDetail = memo(function AuctionDetail({ initialAuction }: { initialAuction: AuctionWithDetails }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/auction/bid/auction-detail.tsx_AuctionDetail_render");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクティブタブ
   *  */
  const [activeTab, setActiveTab] = useState("details");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const { data: session } = useSession();
  const currentUserId = useMemo(() => {
    if (!session?.user?.id) {
      notFound();
    }
    return session.user.id;
  }, [session?.user?.id]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useAuctionEventフックを使用してSSEからリアルタイムデータを取得
   */
  const { auction = initialAuction, loading, error, lastMsg } = useAuctionEvent(initialAuction);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カウントダウンの状態
   */
  const { countdownState, formatCountdown } = useCountdown(new Date(auction.endTime || initialAuction.endTime), () => {
    console.log("カウントダウンが終了しました");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ウォッチリスト
   * watchはuserIdが必要で、userIdを入れるとキャッシュできないため、意図的に取得しない
   */
  const { isLoading, toggleWatchlist, isWatchlisted } = useWatchlist(auction.id, null);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションがアクティブかどうか
   */
  const isActive = useMemo(() => {
    console.log("src/components/auction/bid/auction-detail.tsx_isActive", auction.status, auction.startTime);
    const auctionStartTime = typeof auction.startTime === "string" ? new Date(auction.startTime) : auction.startTime;
    const auctionEndTime = typeof auction.endTime === "string" ? new Date(auction.endTime) : auction.endTime;
    const now = new Date();
    if (auction.status === AuctionStatus.ACTIVE && auctionStartTime < now && auctionEndTime > now) {
      return true;
    } else {
      return false;
    }
  }, [auction.startTime, auction.endTime, auction.status]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実行者かどうか
   */
  const isExecutor = useMemo(() => {
    console.log(
      "src/components/auction/bid/auction-detail.tsx_isExecutor",
      currentUserId,
      auction.task.executors.map((executor) => executor.user?.id),
    );
    return auction.task.executors.some((executor) => executor.user?.id === currentUserId);
  }, [auction.task.executors, currentUserId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション詳細タブの内容
   */
  const renderDetailsTab = useCallback(() => {
    console.log("src/components/auction/bid/auction-detail.tsx_renderDetailsTab_render");

    return (
      <div className="space-y-6">
        {/* 現在価格、開始価格、入札数を表示するカード */}
        <Card className="overflow-hidden border-none shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4 text-center shadow-sm">
                <p className="text-muted-foreground text-xs font-medium uppercase">現在価格</p>
                <p className="mt-2 text-3xl font-bold text-blue-700">{formatCurrency(auction.currentHighestBid ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 p-4 text-center shadow-sm">
                <p className="text-muted-foreground text-xs font-medium uppercase">最低入札額</p>
                <p className="mt-2 text-3xl font-bold text-green-700">{formatCurrency((auction.currentHighestBid ?? 0) + 1)}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4 text-center shadow-sm">
                <p className="text-muted-foreground text-xs font-medium uppercase">入札数</p>
                <p className="mt-2 text-3xl font-bold text-purple-700">
                  {auction.bidHistories.length > 25 ? "25+" : (auction.bidHistories.length ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 自分の出品しているオークションの場合は、自分の出品したオークションですというメッセージを表示 */}
        {isExecutor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center"
          >
            <User className="mx-auto mb-2 h-6 w-6 text-blue-500" />
            <p className="font-medium text-blue-800">自分の出品したオークションです</p>
          </motion.div>
        )}

        {/* オークションのステータスがACTIVE以外の場合のメッセージを表示 */}
        {!isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-center"
          >
            <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-orange-500" />
            <p className="font-medium text-orange-800">このオークションは現在アクティブではありません</p>
          </motion.div>
        )}

        {/* 自分の出品していないオークションで、オークションがACTIVEで、オークションが終了していない場合は入札フォームを表示 */}
        {!isExecutor && isActive && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <BidForm
              currentHighestBid={auction.currentHighestBid}
              currentHighestBidderId={auction.currentHighestBidderId ?? null}
              auctionId={auction.id}
            />
          </motion.div>
        )}
      </div>
    );
  }, [auction.currentHighestBid, auction.currentHighestBidderId, auction.id, auction.bidHistories.length, isActive, isExecutor]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 配送・支払いタブの内容
  const renderShippingTab = useCallback(() => {
    return (
      <div className="space-y-6 py-4">
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <TruckIcon className="mt-1 h-5 w-5 text-blue-500" />
            <div>
              <h3 className="mb-2 text-lg font-medium text-blue-900">配送方法</h3>
              <p className="text-blue-700">出品者と直接調整してください。詳細は落札後に確認できます。</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <ShoppingBag className="mt-1 h-5 w-5 text-green-500" />
            <div>
              <h3 className="mb-2 text-lg font-medium text-green-900">支払い方法</h3>
              <p className="text-green-700">
                落札後、自動的にポイントが使用されます。 預けたポイントは、落札から
                {`${auction.task.group.depositPeriod}日後`}に返還されます。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }, [auction.task.group.depositPeriod]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング状態の表示
   */
  if (loading) {
    return <LoadingIndicator />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * エラー状態の表示
   */
  if (error) {
    return <ErrorIndicator error={error} />;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8">
      {/* SSEデバッグ情報表示エリア */}
      {process.env.NODE_ENV == "development" && lastMsg && (
        <div className="overflow-x-auto rounded-md bg-slate-100 p-2 font-mono text-xs">
          <p className="mb-1 font-semibold">最後に受信したSSEメッセージ:</p>
          <pre className="break-all whitespace-pre-wrap">{lastMsg}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
        {/* 左側: オークション画像 */}
        <div className="relative h-[300px] overflow-hidden rounded-lg shadow-md md:h-[400px]">
          <Image
            src={auction.task?.imageUrl ?? AUCTION_CONSTANTS?.DEFAULT_AUCTION_IMAGE_URL ?? ""}
            alt={auction.task?.task ?? "オークション画像"}
            fill
            className="object-cover transition-transform duration-500 hover:scale-105"
            priority
          />
        </div>

        {/* 右側: オークション情報ヘッダー部分 */}
        <div className="flex flex-col justify-between space-y-4">
          <div>
            <div className="mb-2 flex items-start justify-between">
              <h1 className="text-2xl font-bold">{auction.task.task}</h1>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleWatchlist}
                disabled={isLoading}
                className={`flex h-10 w-10 items-center justify-center rounded-full ${isWatchlisted ? "bg-red-50 text-red-500" : "bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-500"} transition-colors duration-200`}
              >
                <Heart className={isWatchlisted ? "fill-current" : ""} size={20} />
              </motion.button>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                <User size={16} className="text-primary" />
              </div>
              <p className="text-muted-foreground">
                {auction.task.executors.find((executor) => executor.user?.id === currentUserId)?.user?.settings?.username ?? "不明なユーザー"}
              </p>
            </div>
          </div>

          {/* オークションのステータスとグループを表示 */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isActive ? "secondary" : "destructive"} className="px-3 py-1 text-sm font-medium">
              {isActive ? "出品中" : "終了"}
            </Badge>
            {auction.task.group && (
              <Badge key={auction.task.group.id} variant="outline" className="px-3 py-1 text-sm font-medium">
                {auction.task.group.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* カウントダウン表示部分 */}
      <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
        <CountdownDisplay countdownState={countdownState} countdownAction={formatCountdown} />
      </div>

      {/* タブ切り替え部分 */}
      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="px-6 pb-6">
        <TabsList className="bg-muted/50 mb-6 grid w-full grid-cols-4 gap-1 rounded-lg p-1.5">
          <TabsTrigger
            value="details"
            className="flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Info className="h-4 w-4" />
            <span>詳細</span>
          </TabsTrigger>
          <TabsTrigger
            value="bid-history"
            className="flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <BarChart className="h-4 w-4" />
            <span>入札履歴</span>
          </TabsTrigger>
          <TabsTrigger
            value="qa"
            className="flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <MessageSquare className="h-4 w-4" />
            <span>質問と回答</span>
          </TabsTrigger>
          <TabsTrigger
            value="shipping"
            className="flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <TruckIcon className="h-4 w-4" />
            <span>配送・支払い</span>
          </TabsTrigger>
        </TabsList>

        <div className="relative">
          {activeTab === "details" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <TabsContent value="details" className="mt-0">
                {renderDetailsTab()}
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "bid-history" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <TabsContent value="bid-history" className="mt-0">
                {/* SSEで取得した入札履歴を渡す */}
                {<BidHistory initialBids={auction.bidHistories} />}
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "qa" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <TabsContent value="qa" className="mt-0">
                <AuctionQA
                  auctionId={auction.id}
                  isDisplayAfterEnd={false}
                  isEnd={auction.status === AuctionStatus.ENDED}
                  auctionEndDate={auction.endTime}
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "shipping" && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
              <TabsContent value="shipping" className="mt-0">
                {renderShippingTab()}
              </TabsContent>
            </motion.div>
          )}
        </div>
      </Tabs>
    </motion.div>
  );
});
