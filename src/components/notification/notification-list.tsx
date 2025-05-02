"use client";

import type { AuctionFilterType, FilterType, NotificationData } from "@/hooks/notification/use-notification-list";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationList } from "@/hooks/notification/use-notification-list";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw, ShoppingCart } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ローディングインジケーター
 */
const LoadingIndicator = memo(function LoadingIndicator() {
  return <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フィルタータブコンポーネント
 * @param {FilterType} activeFilter - 現在のフィルター状態
 * @param {function} onFilterChange - フィルター状態変更時のコールバック
 * @param {number} unreadCount - 未読通知の数
 */
const FilterTabs = memo(function FilterTabs({
  activeFilter,
  onFilterChange,
  unreadCount,
}: {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  unreadCount: number;
}) {
  return (
    <div className="sticky top-0 z-10 mb-3 flex border-b bg-white">
      <button
        onClick={() => onFilterChange("all")}
        className={
          activeFilter === "all"
            ? "border-b-2 border-blue-500 px-4 py-2 font-medium text-blue-600"
            : "px-4 py-2 font-medium text-gray-500 hover:text-gray-700"
        }
      >
        全て
      </button>
      <button
        onClick={() => onFilterChange("unread")}
        className={
          activeFilter === "unread"
            ? "border-b-2 border-blue-500 px-4 py-2 font-medium text-blue-600"
            : "px-4 py-2 font-medium text-gray-500 hover:text-gray-700"
        }
      >
        未読
        {unreadCount > 0 && <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
      </button>
      <button
        onClick={() => onFilterChange("read")}
        className={
          activeFilter === "read"
            ? "border-b-2 border-blue-500 px-4 py-2 font-medium text-blue-600"
            : "px-4 py-2 font-medium text-gray-500 hover:text-gray-700"
        }
      >
        既読
      </button>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知アイテムコンポーネント
 * @param {NotificationData} notification - 通知データ
 * @param {function} onToggleReadStatus - 未読状態変更時のコールバック
 * @returns {React.ReactNode} 通知アイテムのReactノード
 */
const NotificationItem = memo(function NotificationItem({
  notification,
  onToggleReadStatus,
}: {
  notification: NotificationData;
  onToggleReadStatus: (id: string, isRead: boolean) => void;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // 通知アイテムが展開されているかどうか
  const [isExpanded, setIsExpanded] = useState(false);
  // 通知アイテムが未読かどうか
  const [localIsRead, setLocalIsRead] = useState(notification.isRead);
  // 通知アイテムの読み込み中かどうか
  const [isProcessing, setIsProcessing] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useEffect
   */
  // 通知アイテムが未読かどうかを更新
  useEffect(() => {
    if (localIsRead !== notification.isRead) {
      setLocalIsRead(notification.isRead);
    }
  }, [notification.isRead, localIsRead]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useCallback
   */

  /**
   * メッセージを短縮
   * @param {string} message - メッセージ
   * @param {number} maxLength - 最大長
   * @returns {string} 短縮されたメッセージ
   */
  const truncateMessage = useCallback(function truncateMessage(message: string, maxLength = 50) {
    if (!message) return "";
    return message.length > maxLength ? message.substring(0, maxLength) + "..." : message;
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知アイテムをクリック
   */
  const handleItemClick = useCallback(function handleItemClick() {
    setIsExpanded((prev) => !prev);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知アイテムのステータスボタンをクリック
   */
  const handleStatusButtonClick = useCallback(
    function handleStatusButtonClick(e: React.MouseEvent) {
      e.stopPropagation();

      if (isProcessing) {
        return;
      }

      const newStatus = !localIsRead;
      setIsProcessing(true);
      setLocalIsRead(newStatus);
      onToggleReadStatus(notification.id, newStatus);

      setTimeout(() => setIsProcessing(false), 300);
    },
    [isProcessing, localIsRead, notification.id, onToggleReadStatus],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useMemo
   */
  const backgroundClass = useMemo(
    function backgroundClass() {
      return localIsRead ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-blue-950/20";
    },
    [localIsRead],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 展開された通知アイテムのパディングクラス
   */
  const expandedPaddingClass = useMemo(
    function expandedPaddingClass() {
      return isExpanded ? "p-0" : "p-3";
    },
    [isExpanded],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 展開された通知アイテムのヘッダークラス
   */
  const expandedHeaderClass = useMemo(
    function expandedHeaderClass() {
      return isExpanded ? "border-b p-3" : "";
    },
    [isExpanded],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知アイテムを返す
   */
  return (
    <li className={`flex flex-col rounded-lg border transition-colors ${backgroundClass} ${expandedPaddingClass}`}>
      <div
        className={`flex cursor-pointer items-start gap-3 ${expandedHeaderClass}`}
        onClick={handleItemClick}
        onKeyDown={(e) => e.key === "Enter" && handleItemClick()}
        role="button"
        tabIndex={0}
        aria-label={`通知: ${notification.title}`}
      >
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold">{notification.title}</h4>
            </div>
            <time className="text-xs text-gray-500" dateTime={notification.sentAt.toISOString()}>
              {formatDistanceToNow(notification.sentAt, { addSuffix: true, locale: ja })}
            </time>
          </div>

          <div className="mt-1 flex items-center text-sm text-gray-500">
            {notification.NotificationTargetType === "USER" && notification.senderUserId && (
              <>
                <span className="mr-1">👤</span>
                <span>ユーザー: {notification.userName ?? notification.senderUserId}</span>
              </>
            )}
            {notification.NotificationTargetType === "GROUP" && notification.groupId && (
              <>
                <span className="mr-1">👥</span>
                <span>グループ: {notification.groupName ?? notification.groupId}</span>
              </>
            )}
            {notification.NotificationTargetType === "TASK" && notification.taskId && (
              <>
                <span className="mr-1">📋</span>
                <span>タスク: {notification.taskName ?? notification.taskId}</span>
              </>
            )}
            {notification.NotificationTargetType === "SYSTEM" && (
              <>
                <span className="mr-1">🔔</span>
                <span>システム全体</span>
              </>
            )}
            {notification.auctionEventType && (
              <span className="ml-2 flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                <ShoppingCart className="mr-1 inline-block h-3 w-3" />
                <span className="leading-none">オークション: {formatAuctionEventType(notification.auctionEventType)}</span>
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{isExpanded ? notification.message : truncateMessage(notification.message)}</p>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex-1">
              {isExpanded && notification.actionUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (notification.actionUrl) {
                      window.open(notification.actionUrl, "_blank");
                    }
                  }}
                >
                  詳細を確認
                </Button>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 bg-gray-100 px-2 text-xs text-gray-500 hover:bg-gray-300"
              disabled={isProcessing}
              onClick={handleStatusButtonClick}
            >
              {isProcessing ? (
                <>
                  <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  更新中...
                </>
              ) : localIsRead ? (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  未読にする
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  既読にする
                </>
              )}
            </Button>
          </div>
        </div>

        {localIsRead ? <span className="invisible mt-1 h-2 w-2" /> : <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
      </div>
    </li>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知が空の場合に表示するコンポーネント
 * @param {boolean} hasMore - もっと読み込むボタンの表示有無
 * @param {function} onLoadMore - もっと読み込むボタンのクリック時のコールバック
 * @param {boolean} isLoadingMore - もっと読み込むボタンのローディング状態
 * @param {FilterType} activeFilter - 現在のフィルター状態
 */
const NotificationsEmpty = memo(function NotificationsEmpty({
  hasMore,
  onLoadMore,
  isLoadingMore,
  activeFilter,
}: {
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  activeFilter: FilterType;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useMemo
   */
  const emptyMessage = useMemo(
    function emptyMessage() {
      let emptyMessage = "通知はありません";

      if (activeFilter === "unread") {
        emptyMessage = "未読の通知はありません";
      } else if (activeFilter === "read") {
        emptyMessage = "既読の通知はありません";
      }

      return emptyMessage;
    },
    [activeFilter],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知が空の場合に表示するコンポーネントを返す
   */
  return (
    <div className="flex h-[300px] flex-col items-center justify-center text-gray-500">
      <p className="mb-4">{emptyMessage}</p>

      {hasMore && (
        <div className="flex justify-center py-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore} className="w-full text-sm">
            {isLoadingMore ? (
              <>
                <LoadingIndicator />
                読み込み中...
              </>
            ) : (
              <>
                <MoreHorizontal className="mr-1 h-4 w-4" />
                もっと読み込む
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 読み込み中のコンポーネント
 */
const Loading = memo(function Loading() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="border-primary mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-sm text-gray-500">通知を読み込み中...</p>
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エラーのコンポーネント
 */
const Error = memo(function Error({ error, handleManualRefresh }: { error: string; handleManualRefresh: () => void }) {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-center text-red-500">
        <AlertCircle className="mx-auto mb-2 h-6 w-6" />
        <p className="text-sm">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={handleManualRefresh}>
          再度読み込む
        </Button>
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントタイプを日本語に変換
 */
const formatAuctionEventType = (eventType: string): string => {
  const eventTypes: Record<string, string> = {
    ITEM_SOLD: "落札完了",
    NO_WINNER: "落札者なし",
    ENDED: "終了",
    OUTBID: "入札更新",
    QUESTION_RECEIVED: "質問受信",
    AUTO_BID_LIMIT_REACHED: "自動入札上限到達",
    AUCTION_WIN: "落札",
    AUCTION_LOST: "落札失敗",
    POINT_RETURNED: "ポイント返却",
    AUCTION_CANCELED: "キャンセル",
  };

  return eventTypes[eventType] || eventType;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション通知フィルターコンポーネント
 */
const AuctionFilterControl = memo(function AuctionFilterControl({
  activeAuctionFilter,
  onAuctionFilterChange,
}: {
  activeAuctionFilter: AuctionFilterType;
  onAuctionFilterChange: (filter: AuctionFilterType) => void;
}) {
  return (
    <div className="mb-2 flex items-center">
      <div className="flex h-8 items-center gap-1 rounded-lg bg-gray-100 p-1">
        <button
          className={cn(
            "flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-colors",
            activeAuctionFilter === "all" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
          onClick={() => onAuctionFilterChange("all")}
        >
          すべて
        </button>
        <button
          className={cn(
            "flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-colors",
            activeAuctionFilter === "auction-only" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
          onClick={() => onAuctionFilterChange("auction-only")}
        >
          <ShoppingCart className="h-3 w-3" />
          オークションのみ
        </button>
        <button
          className={cn(
            "flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-colors",
            activeAuctionFilter === "exclude-auction" ? "bg-white text-black shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
          onClick={() => onAuctionFilterChange("exclude-auction")}
        >
          <ShoppingCart className="h-3 w-3" />
          オークション以外
        </button>
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知リストコンポーネント
 * @param {NotificationData[]} notifications - 通知データの配列
 * @param {boolean} hasMore - もっと読み込むボタンの表示有無
 * @param {boolean} isLoadingMore - もっと読み込むボタンのローディング状態
 * @param {FilterType} activeFilter - 現在のフィルター状態
 * @param {function} loadMoreNotifications - もっと読み込むボタンのクリック時のコールバック
 * @param {function} toggleReadStatus - 未読状態変更時のコールバック
 */
const Notifications = memo(function Notifications({
  notifications,
  hasMore,
  isLoadingMore,
  activeFilter,
  loadMoreNotifications,
  toggleReadStatus,
}: {
  notifications: NotificationData[];
  hasMore: boolean;
  isLoadingMore: boolean;
  activeFilter: FilterType;
  loadMoreNotifications: () => void;
  toggleReadStatus: (id: string, isRead: boolean) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 pr-4">
        {notifications.length > 0 ? (
          <>
            <ul className="space-y-3">
              {notifications.map((notification: NotificationData) => (
                <NotificationItem key={notification.id} notification={notification} onToggleReadStatus={toggleReadStatus} />
              ))}
            </ul>

            {/* もっと読み込むボタン */}
            {hasMore && (
              <div className="mt-4 flex justify-center py-2">
                <Button variant="outline" size="sm" onClick={loadMoreNotifications} disabled={isLoadingMore} className="w-full text-sm">
                  {isLoadingMore ? (
                    <>
                      <LoadingIndicator />
                      読み込み中...
                    </>
                  ) : (
                    <>
                      <MoreHorizontal className="mr-1 h-4 w-4" />
                      もっと読み込む
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <NotificationsEmpty hasMore={hasMore} onLoadMore={loadMoreNotifications} isLoadingMore={isLoadingMore} activeFilter={activeFilter} />
        )}
      </div>
    </ScrollArea>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知リストコンポーネント
 * @param {function} onUnreadStatusChangeAction - 未読状態変更時のコールバック
 */
export const NotificationList = memo(function NotificationList({
  onUnreadStatusChangeAction,
}: {
  onUnreadStatusChangeAction?: (hasUnread: boolean) => void;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const {
    notifications,
    isLoading,
    isLoadingMore,
    error,
    unreadCount,
    hasMore,
    activeFilter,
    activeAuctionFilter,
    toggleReadStatus,
    loadMoreNotifications,
    markAllAsRead,
    handleFilterChange,
    handleAuctionFilterChange,
    handleManualRefresh,
    requestCounter,
  } = useNotificationList(onUnreadStatusChangeAction);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex flex-col overflow-hidden">
      {/* フィルタータブ - 固定 */}
      <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} unreadCount={unreadCount} />

      {/* ヘッダー部分 - 固定 */}
      <div className="mb-4 flex flex-col">
        {/* 上段: 未読カウントとリロードボタン */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800 dark:text-gray-200">{unreadCount > 0 ? `${unreadCount}件の未読` : "未読はありません"}</span>
            <Button variant="ghost" size="icon" onClick={handleManualRefresh} className="h-7 w-7 rounded-full" title="手動更新">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {requestCounter > 0 && <span className="text-xs text-gray-500">リクエスト: {requestCounter}回</span>}
          </div>

          {/* すべて既読にするボタン */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="bg-gray-100 text-xs text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                すべて既読にする
              </Button>
            )}
          </div>
        </div>

        {/* 下段: オークションフィルター */}
        <AuctionFilterControl activeAuctionFilter={activeAuctionFilter} onAuctionFilterChange={handleAuctionFilterChange} />
      </div>

      {/* 通知リスト部分 - スクロール可能エリア */}
      <div className="overflow-hidden">
        {isLoading ? (
          <Loading />
        ) : error ? (
          <Error error={error} handleManualRefresh={handleManualRefresh} />
        ) : (
          <Notifications
            notifications={notifications}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            activeFilter={activeFilter}
            loadMoreNotifications={loadMoreNotifications}
            toggleReadStatus={toggleReadStatus}
          />
        )}
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
