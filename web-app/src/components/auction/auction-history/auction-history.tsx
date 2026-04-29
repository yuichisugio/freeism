"use client";

import { memo, useCallback, useMemo } from "react";
import { BidStatusBadge, TaskRoleBadge, TaskStatusBadge } from "@/components/auction/common/status-badge";
import { Loading } from "@/components/share/share-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuctionHistory } from "@/hooks/auction/history/use-auction-history";
import {
  type AuctionCreatedTabFilter,
  type BidHistoryItem,
  type CreatedAuctionItem,
  type WonAuctionItem,
} from "@/types/auction-types";
import { formatDistanceToNow, isValid } from "date-fns";
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
  rightBadge?: React.ReactNode;
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
  if (loading) return <Loading />;

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
    itemPerPage,
    bidHistoryResult,
    wonHistoryResult,
    createdHistoryResult,
    currentDataCount,
    isLoadingCurrentTab,
    filter,
    VALID_UI_FILTERS,
    filterCondition,
    wonStatus,
    // function
    handleTabChange,
    handlePageChange,
    handleItemClick,
    handleWonItemClick,
    handleCreatedItemClick,
    handleItemPerPageChange,
    handleFilterChange,
    handleClearFilters,
    handleFilterConditionChange,
    setParams,
  } = useAuctionHistory();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターの選択肢とラベルのマッピング
   */
  const filterOptions: { id: AuctionCreatedTabFilter; label: string }[] = useMemo(
    () =>
      VALID_UI_FILTERS.map((f) => {
        switch (f) {
          case "creator":
            return { id: f, label: "あなたが作成" };
          case "executor":
            return { id: f, label: "あなたが提供" };
          case "reporter":
            return { id: f, label: "あなたが報告" };
          case "active":
            return { id: f, label: "開催中" };
          case "ended":
            return { id: f, label: "オークション終了" };
          case "pending":
            return { id: f, label: "開始前" };
          case "supplier_done":
            return { id: f, label: "提供の完了（タスク完了含む）" };
          default: {
            const exhaustiveCheck: never = f;
            return { id: exhaustiveCheck as AuctionCreatedTabFilter, label: String(exhaustiveCheck) };
          }
        }
      }),
    [VALID_UI_FILTERS],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルターのチェックボックスの変更
   */
  const onFilterCheckboxChange = useCallback(
    (filterId: AuctionCreatedTabFilter, checked: boolean) => {
      const newFilter = checked ? [...filter, filterId] : filter.filter((f) => f !== filterId);
      handleFilterChange(newFilter);
    },
    [filter, handleFilterChange],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札履歴
   */
  const renderBidItem = useCallback(
    (bid: BidHistoryItem) => {
      return (
        <HistoryCard
          key={bid.auctionId}
          id={bid.auctionId}
          title={bid.taskName}
          timestamp={new Date(bid.lastBidAt)}
          timestampIcon={<Clock size={14} />}
          timestampText={
            isValid(new Date(bid.lastBidAt))
              ? `${formatDistanceToNow(new Date(bid.lastBidAt), { addSuffix: true, locale: ja })}に入札`
              : "日付不明"
          }
          amount={bid.currentHighestBid}
          amountLabel="入札額"
          leftBadge={<BidStatusBadge status={bid.bidStatus} />}
          rightBadge={<TaskStatusBadge status={bid.taskStatus} />}
          onClick={handleItemClick}
          extraContent={
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-gray-500">現在の最高額</div>
              <div className="font-medium">{bid.currentHighestBid.toLocaleString()} ポイント</div>
            </div>
          }
        />
      );
    },
    [handleItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札履歴をレンダリング
   */
  const renderWonItem = useCallback(
    (auction: WonAuctionItem) => {
      return (
        <HistoryCard
          key={auction.auctionId}
          id={auction.auctionId}
          title={auction.taskName}
          timestamp={new Date(auction.auctionEndTime)}
          timestampIcon={<Award size={14} />}
          timestampText={
            isValid(new Date(auction.auctionEndTime))
              ? `${formatDistanceToNow(new Date(auction.auctionEndTime), { addSuffix: true, locale: ja })}に落札`
              : "日付不明"
          }
          amount={auction.currentHighestBid}
          amountLabel="落札額"
          deliveryMethod={auction.deliveryMethod}
          leftBadge={<TaskStatusBadge status={auction.taskStatus} />}
          onClick={handleWonItemClick}
        />
      );
    },
    [handleWonItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品履歴
   */
  const renderCreatedItem = useCallback(
    (auction: CreatedAuctionItem) => {
      return (
        <HistoryCard
          key={auction.auctionId}
          id={auction.auctionId}
          title={auction.taskName}
          timestamp={new Date(auction.auctionCreatedAt)}
          timestampIcon={<Tag size={14} />}
          timestampText={
            isValid(new Date(auction.auctionCreatedAt))
              ? `${formatDistanceToNow(new Date(auction.auctionCreatedAt), { addSuffix: true, locale: ja })}に出品`
              : "日付不明"
          }
          amount={auction.currentHighestBid}
          amountLabel={auction.taskStatus === "AUCTION_ENDED" && auction.winnerId ? "落札額" : "現在の最高額"}
          avatarName={auction.winnerName ?? (auction.taskStatus === "AUCTION_ENDED" ? "落札者なし" : "落札者未定")}
          leftBadge={<TaskStatusBadge status={auction.taskStatus} />}
          rightBadge={<TaskRoleBadge role={auction.taskRole} />}
          onClick={handleCreatedItemClick}
        />
      );
    },
    [handleCreatedItemClick],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
          {/* 入札履歴（重複なしのオークション単位での履歴を表示） */}
          <HistoryGrid
            items={bidHistoryResult?.data ?? []}
            renderItem={renderBidItem}
            emptyMessage="入札履歴はありません"
            loading={isLoadingCurrentTab}
          />
        </TabsContent>

        <TabsContent value="won" forceMount={activeTab === "won" ? undefined : true} hidden={activeTab !== "won"}>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="wonStatus"
                value="all"
                checked={wonStatus === "all"}
                onChange={() => setParams((prev) => ({ ...prev, wonStatus: "all", page: 1 }))}
                className="accent-blue-600"
              />
              すべて
            </Label>
            <Label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="wonStatus"
                value="completed"
                checked={wonStatus === "completed"}
                onChange={() => setParams((prev) => ({ ...prev, wonStatus: "completed", page: 1 }))}
                className="accent-blue-600"
              />
              報告タスク済み
            </Label>
            <Label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="wonStatus"
                value="incomplete"
                checked={wonStatus === "incomplete"}
                onChange={() => setParams((prev) => ({ ...prev, wonStatus: "incomplete", page: 1 }))}
                className="accent-blue-600"
              />
              報告タスク未完了
            </Label>
          </div>
          <HistoryGrid
            items={wonHistoryResult?.data ?? []}
            renderItem={renderWonItem}
            emptyMessage="落札履歴はありません"
            loading={isLoadingCurrentTab}
          />
        </TabsContent>

        <TabsContent
          value="created"
          forceMount={activeTab === "created" ? undefined : true}
          hidden={activeTab !== "created"}
        >
          <div className="mb-4 flex-col items-center border-b pb-4">
            <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-4">
              <p className="text-base font-semibold text-gray-700">フィルター</p>
              {filterOptions.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`filter-${option.id}`}
                    checked={filter.includes(option.id)}
                    onCheckedChange={(checked) => {
                      onFilterCheckboxChange(option.id, !!checked);
                    }}
                    aria-label={option.label}
                  />
                  <Label htmlFor={`filter-${option.id}`} className="cursor-pointer text-sm font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-x-4">
              <Button
                variant="outline"
                size="sm"
                className="min-w-[72px]"
                onClick={handleClearFilters}
                disabled={filter.length === 0}
              >
                クリア
              </Button>
              <div className="flex items-center space-x-2">
                <Label
                  htmlFor="filter-condition-switch"
                  className="inline-block w-[72px] text-center text-sm whitespace-nowrap"
                >
                  {filterCondition === "and" ? "AND検索" : "OR検索"}
                </Label>
                <Switch
                  id="filter-condition-switch"
                  checked={filterCondition === "and"}
                  onCheckedChange={(checked) => handleFilterConditionChange(checked ? "and" : "or")}
                  aria-label="フィルター条件をANDとORで切り替え"
                  disabled={filter.length < 1}
                />
              </div>
            </div>
          </div>
          <HistoryGrid
            items={createdHistoryResult?.data ?? []}
            renderItem={renderCreatedItem}
            emptyMessage="出品履歴はありません"
            loading={isLoadingCurrentTab}
          />
        </TabsContent>
      </Tabs>

      {/* ページネーション部分は一時的にコメントアウトしてLinterエラーを回避 */}
      {!isLoadingCurrentTab && currentDataCount && currentDataCount > 0 && (
        <AuctionHistoryPagination
          pagination={{
            currentPage: currentPage,
            onPageChange: handlePageChange,
            totalRowCount: currentDataCount,
            itemPerPage: itemPerPage,
            onItemPerPageChange: handleItemPerPageChange,
          }}
        />
      )}
    </div>
  );
});
