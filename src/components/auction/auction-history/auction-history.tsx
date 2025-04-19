"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rating } from "@/components/auction/common/rating";
import { AuctionStatusBadge, BidStatusBadge, TaskStatusBadge } from "@/components/auction/common/status-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserCreatedAuctions, getUserLatestBids, getUserWonAuctions } from "@/lib/auction/action/history";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/lib/auction/type/types";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Award, Clock, Loader2, Tag } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通の履歴表示コンポーネントのprops
 */
type HistoryCardProps = {
  id: string;
  title: string;
  timestamp: Date | string;
  timestampIcon: React.ReactNode;
  timestampText: string;
  amount: number;
  amountLabel: string;
  avatarSrc?: string | null;
  avatarName?: string | null;
  deliveryMethod?: string | null;
  leftBadge: React.ReactNode;
  rightBadge: React.ReactNode;
  onClick: (id: string) => void;
  extraContent?: React.ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 履歴カードコンポーネント
 * @param {HistoryCardProps} props - 履歴カードのプロパティ
 * @returns {React.ReactNode} 履歴カードのReactノード
 */
const HistoryCard = memo(function HistoryCard({
  id,
  title,
  timestampIcon,
  timestampText,
  amount,
  amountLabel,
  avatarSrc,
  avatarName,
  deliveryMethod,
  leftBadge,
  rightBadge,
  onClick,
  extraContent,
}: HistoryCardProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Card key={id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => onClick(id)}>
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1 text-lg">{title}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {timestampIcon}
          <span>{timestampText}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-gray-500">{amountLabel}</div>
          <div className="text-lg font-semibold">{amount.toLocaleString()} ポイント</div>
        </div>
        {extraContent}
        {avatarSrc !== undefined && avatarName !== undefined && <span className="text-sm">{avatarName}</span>}
        {deliveryMethod && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-medium">提供方法: </span>
            {deliveryMethod}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between pt-0">
        {leftBadge}
        {rightBadge}
      </CardFooter>
    </Card>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 空の履歴メッセージコンポーネント
 * @param {Object} props - 空の履歴メッセージのプロパティ
 * @param {string} props.message - 表示するメッセージ
 * @returns {React.ReactNode} 空の履歴メッセージのReactノード
 */
const EmptyHistoryMessage = memo(function EmptyHistoryMessage({ message }: { message: string }) {
  return <div className="py-10 text-center text-gray-500">{message}</div>;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 共通の履歴グリッドコンポーネント
type HistoryGridProps<T> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyMessage: string;
  loading: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 履歴グリッドコンポーネント
 * @param {HistoryGridProps<T>} props - 履歴グリッドのプロパティ
 * @returns {React.ReactNode} 履歴グリッドのReactノード
 */
const HistoryGrid = memo(function HistoryGrid<T>({ items, renderItem, emptyMessage, loading }: HistoryGridProps<T>) {
  if (loading) return null;
  if (items.length === 0) return <EmptyHistoryMessage message={emptyMessage} />;

  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map(renderItem)}</div>;
}) as <T>(props: HistoryGridProps<T>) => React.ReactNode;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
/**
 * 入札・落札履歴コンポーネント
 * @returns 入札・落札履歴コンポーネント
 */
export const AuctionHistory = memo(function AuctionHistory() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const router = useRouter();
  const [bidHistory, setBidHistory] = useState<BidHistoryItem[]>([]);
  const [wonAuctions, setWonAuctions] = useState<WonAuctionItem[]>([]);
  const [createdAuctions, setCreatedAuctions] = useState<CreatedAuctionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<string>("bids");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // タブ切り替え時のロジック
  const handleTabChange = useCallback((value: string) => {
    setCurrentTab(value);
  }, []);

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

  // 入札履歴アイテムのレンダリング
  const renderBidItem = useCallback(
    (bid: BidHistoryItem) => (
      <HistoryCard
        key={bid.id}
        id={bid.auction.task.id}
        title={bid.auction.task.task}
        timestamp={new Date(bid.createdAt)}
        timestampIcon={<Clock size={14} />}
        timestampText={`${formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true, locale: ja })}に入札`}
        amount={bid.amount}
        amountLabel="入札額"
        leftBadge={<BidStatusBadge status={bid.status} />}
        rightBadge={<AuctionStatusBadge status={bid.auction.status} />}
        onClick={handleItemClick}
        extraContent={
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-gray-500">現在の最高額</div>
            <div className="font-medium">{bid.auction.currentHighestBid.toLocaleString()} ポイント</div>
          </div>
        }
      />
    ),
    [handleItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 落札履歴アイテムのレンダリング
  const renderWonItem = useCallback(
    (auction: WonAuctionItem) => (
      <HistoryCard
        key={auction.id}
        id={auction.id}
        title={auction.task.task}
        timestamp={new Date(auction.endTime)}
        timestampIcon={<Award size={14} />}
        timestampText={`${formatDistanceToNow(new Date(auction.endTime), { addSuffix: true, locale: ja })}に落札`}
        amount={auction.currentHighestBid}
        amountLabel="落札額"
        avatarName={auction.task.creator.name ?? "出品者"}
        deliveryMethod={auction.task.deliveryMethod}
        leftBadge={<TaskStatusBadge status={auction.task.status} />}
        rightBadge={
          auction.reviews.length > 0 ? <Rating rating={auction.reviews[0].rating} size={16} /> : <span className="text-xs text-gray-500">未評価</span>
        }
        onClick={handleWonItemClick}
      />
    ),
    [handleWonItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 出品履歴アイテムのレンダリング
  const renderCreatedItem = useCallback(
    (auction: CreatedAuctionItem) => (
      <HistoryCard
        key={auction.id}
        id={auction.id}
        title={auction.task.task}
        timestamp={new Date(auction.createdAt)}
        timestampIcon={<Tag size={14} />}
        timestampText={`${formatDistanceToNow(new Date(auction.createdAt), { addSuffix: true, locale: ja })}に出品`}
        amount={auction.currentHighestBid}
        amountLabel="落札額"
        avatarName={auction.winner?.name ?? "落札者"}
        leftBadge={<TaskStatusBadge status={auction.task.status} />}
        rightBadge={<AuctionStatusBadge status={auction.status} />}
        onClick={handleCreatedItemClick}
      />
    ),
    [handleCreatedItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="container mx-auto py-6">
      {/* タブ */}
      <Tabs defaultValue={currentTab} onValueChange={handleTabChange}>
        <div className="mb-8 flex items-center justify-between">
          <TabsList className="grid w-full max-w-[500px] grid-cols-3">
            <TabsTrigger value="bids">入札履歴</TabsTrigger>
            <TabsTrigger value="won">落札履歴</TabsTrigger>
            <TabsTrigger value="created">出品履歴</TabsTrigger>
          </TabsList>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}

        {/* 入札履歴 */}
        <TabsContent value="bids">
          <HistoryGrid items={bidHistory} renderItem={renderBidItem} emptyMessage="入札履歴はありません" loading={loading} />
        </TabsContent>

        {/* 落札履歴 */}
        <TabsContent value="won">
          <HistoryGrid items={wonAuctions} renderItem={renderWonItem} emptyMessage="落札履歴はありません" loading={loading} />
        </TabsContent>

        {/* 出品履歴 */}
        <TabsContent value="created">
          <HistoryGrid items={createdAuctions} renderItem={renderCreatedItem} emptyMessage="出品履歴はありません" loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
});
