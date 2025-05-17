"use client";

import { memo, useCallback } from "react";
import { Rating } from "@/components/auction/common/rating";
import { AuctionStatusBadge, BidStatusBadge, TaskStatusBadge } from "@/components/auction/common/status-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuctionHistory } from "@/hooks/auction/history/use-auction-history";
import { AUCTION_CONSTANTS, AUCTION_HISTORY_CONSTANTS } from "@/lib/constants";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/types/auction-types";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Award, Clock, Tag } from "lucide-react";

import { AuctionHistoryPagination } from "./auction-history-pagination";

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
  avatarName,
  deliveryMethod,
  leftBadge,
  rightBadge,
  onClick,
  extraContent,
}: HistoryCardProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 履歴カード
   */
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
        {avatarName && <span className="text-sm">{avatarName}</span>}
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
 * 共通の履歴グリッドコンポーネント
 */
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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中の場合
   */
  if (loading) return null;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 履歴がない場合
   */
  if (items.length === 0) return <div className="py-10 text-center text-gray-500">{emptyMessage}</div>;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 履歴グリッド
   */
  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map(renderItem)}</div>;
}) as <T>(props: HistoryGridProps<T>) => React.ReactNode;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札・落札履歴コンポーネント
 * @returns 入札・落札履歴コンポーネント
 */
export const AuctionHistory = memo(function AuctionHistory() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 履歴グリッドのフック
   */
  const {
    // state
    activeTab,
    currentPage,
    currentData,
    currentDataCount,
    isLoadingCurrentTab,

    // function
    handleTabChange,
    handlePageChange,
    handleItemClick,
    handleWonItemClick,
    handleCreatedItemClick,
    setItemPerPage,
  } = useAuctionHistory();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札履歴
   */
  const renderBidItem = useCallback(
    (bid: BidHistoryItem) => (
      <HistoryCard
        key={bid.taskId}
        id={bid.taskId}
        title={bid.taskName}
        timestamp={new Date(bid.createdAt)}
        timestampIcon={<Clock size={14} />}
        timestampText={`${formatDistanceToNow(new Date(bid.createdAt), { addSuffix: true, locale: ja })}に入札`}
        amount={bid.currentHighestBid}
        amountLabel="入札額"
        leftBadge={<BidStatusBadge status={bid.status} />}
        rightBadge={<AuctionStatusBadge status={bid.auctionStatus} />}
        onClick={handleItemClick}
        extraContent={
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-gray-500">現在の最高額</div>
            <div className="font-medium">{bid.currentHighestBid.toLocaleString()} ポイント</div>
          </div>
        }
      />
    ),
    [handleItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴をレンダリング
   */
  const renderWonItem = useCallback(
    (auction: WonAuctionItem) => (
      <HistoryCard
        key={auction.auctionId}
        id={auction.auctionId}
        title={auction.taskName}
        timestamp={new Date(auction.auctionEndTime)}
        timestampIcon={<Award size={14} />}
        timestampText={`${formatDistanceToNow(new Date(auction.auctionEndTime), { addSuffix: true, locale: ja })}に落札`}
        amount={auction.currentHighestBid}
        amountLabel="落札額"
        avatarName={auction.taskName}
        deliveryMethod={auction.deliveryMethod}
        leftBadge={<TaskStatusBadge status={auction.taskStatus} />}
        rightBadge={
          auction.rating && auction.rating > 0 ? <Rating rating={auction.rating} size={16} /> : <span className="text-xs text-gray-500">未評価</span>
        }
        onClick={handleWonItemClick}
      />
    ),
    [handleWonItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴
   */
  const renderCreatedItem = useCallback(
    (auction: CreatedAuctionItem) => (
      <HistoryCard
        key={auction.auctionId}
        id={auction.auctionId}
        title={auction.taskName}
        timestamp={new Date(auction.auctionCreatedAt)}
        timestampIcon={<Tag size={14} />}
        timestampText={`${formatDistanceToNow(new Date(auction.auctionCreatedAt), { addSuffix: true, locale: ja })}に出品`}
        amount={auction.currentHighestBid}
        amountLabel={auction.auctionStatus === "ENDED" && auction.winnerId ? "落札額" : "現在の最高額"}
        avatarName={auction.winnerName ?? (auction.auctionStatus === "ENDED" ? "落札者なし" : "落札者未定")}
        leftBadge={<TaskStatusBadge status={auction.taskStatus} />}
        rightBadge={<AuctionStatusBadge status={auction.auctionStatus} />}
        onClick={handleCreatedItemClick}
      />
    ),
    [handleCreatedItemClick],
  );

  // --------------------------------------------------------------------------------

  /**
   * 履歴コンポーネント
   */
  return (
    <div className="container mx-auto py-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="mb-8 flex items-center justify-between">
          <TabsList className="grid w-full max-w-[500px] grid-cols-3">
            <TabsTrigger value="bids">入札履歴</TabsTrigger>
            <TabsTrigger value="won">落札履歴</TabsTrigger>
            <TabsTrigger value="created">出品履歴</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="bids" forceMount={activeTab === "bids" ? undefined : true} hidden={activeTab !== "bids"}>
          <HistoryGrid
            items={currentData as BidHistoryItem[]}
            renderItem={renderBidItem}
            emptyMessage="入札履歴はありません"
            loading={isLoadingCurrentTab}
          />
        </TabsContent>

        <TabsContent value="won" forceMount={activeTab === "won" ? undefined : true} hidden={activeTab !== "won"}>
          <HistoryGrid
            items={currentData as WonAuctionItem[]}
            renderItem={renderWonItem}
            emptyMessage="落札履歴はありません"
            loading={isLoadingCurrentTab}
          />
        </TabsContent>

        <TabsContent value="created" forceMount={activeTab === "created" ? undefined : true} hidden={activeTab !== "created"}>
          <HistoryGrid
            items={currentData as CreatedAuctionItem[]}
            renderItem={renderCreatedItem}
            emptyMessage="出品履歴はありません"
            loading={isLoadingCurrentTab}
          />
        </TabsContent>
      </Tabs>

      {/* ページネーション部分は一時的にコメントアウトしてLinterエラーを回避 */}
      {!isLoadingCurrentTab && currentDataCount > 0 && (
        <AuctionHistoryPagination
          pagination={{
            currentPage: currentPage,
            onPageChange: handlePageChange,
            totalRowCount: currentDataCount,
            itemPerPage: AUCTION_HISTORY_CONSTANTS.ITEMS_PER_PAGE,
            onItemPerPageChange: (rowCount) => setItemPerPage(rowCount),
          }}
        />
      )}
      {!isLoadingCurrentTab && currentDataCount > AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="mr-2 rounded border p-2 disabled:opacity-50"
          >
            前のページ
          </button>
          <span className="p-2">
            {currentPage} / {Math.ceil(currentDataCount / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE)}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === Math.ceil(currentDataCount / AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE)}
            className="ml-2 rounded border p-2 disabled:opacity-50"
          >
            次のページ
          </button>
        </div>
      )}
    </div>
  );
});
