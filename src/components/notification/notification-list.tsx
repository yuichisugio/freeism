"use client";

import type { AuctionFilterType, FilterType } from "@/hooks/notification/use-notification-list";
import type { NotificationData } from "@/lib/actions/cache/cache-notification-utilities";
import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotificationList } from "@/hooks/notification/use-notification-list";
import { useShortcut } from "@/hooks/utils/use-shortcut";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, CheckCircle2, HelpCircle, Loader2, MoreHorizontal, RefreshCw, ShoppingCart } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ローディングインジケーター
 */
const LoadingIndicator = memo(function LoadingIndicator() {
  return <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />;
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 読み込み中のコンポーネント
 */
const Loading = memo(function Loading() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="border-primary mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-sm text-gray-500 dark:text-gray-400">通知を読み込み中...</p>
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
      <div className="text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-red-500" />
        <p className="mb-3 text-sm text-red-500">{error}</p>
        <Button variant="outline" size="sm" onClick={handleManualRefresh} className="rounded-full px-4">
          再度読み込む
        </Button>
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * フィルタータブコンポーネント
 * @param {FilterType} activeFilter - 現在のフィルター状態
 * @param {function} onFilterChange - フィルター状態変更時のコールバック
 * @param {number} unreadCount - 全体の未読数を期待
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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ショートカットキーの設定
   */
  const filters = ["all", "unread", "read"] as const; // 変数名を filter から filters に変更 (可読性のため)
  useShortcut([
    {
      code: "ArrowLeft",
      alt: true,
      preventDefault: true,
      callback: () => {
        const currentIndex = filters.indexOf(activeFilter);
        const prevIndex = (currentIndex - 1 + filters.length) % filters.length; // 前のフィルターへ（配列の先頭に来たら末尾へ）
        onFilterChange(filters[prevIndex]);
      },
    },
    {
      code: "ArrowRight",
      alt: true,
      callback: () => {
        const currentIndex = filters.indexOf(activeFilter);
        const nextIndex = (currentIndex + 1) % filters.length; // 次のフィルターへ（配列の末尾に来たら先頭へ）
        onFilterChange(filters[nextIndex]);
      },
    },
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="dark:bg-gray-850 mb-4 flex w-full rounded-lg bg-white p-1 shadow-sm">
      <button
        onClick={() => onFilterChange("all")}
        className={cn(
          "tracking-[.1em] focus:outline-none focus-visible:ring-0",
          "flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200",
          activeFilter === "all"
            ? "bg-green-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800/30 dark:hover:text-gray-100",
        )}
      >
        全て
      </button>
      <button
        onClick={() => onFilterChange("unread")}
        className={cn(
          "tracking-[.1em] focus:outline-none focus-visible:ring-0",
          "relative flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200",
          activeFilter === "unread"
            ? "bg-green-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800/30 dark:hover:text-gray-100",
        )}
      >
        未読
        {unreadCount > 0 && (
          <span
            className={cn(
              "ml-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 pr-2.5 pl-3 text-xs font-semibold text-white dark:bg-gray-900 dark:text-white",
              activeFilter === "unread" && "bg-gray-700 text-white dark:bg-white dark:text-gray-900",
            )}
          >
            {unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onFilterChange("read")}
        className={cn(
          "tracking-[.1em] focus:outline-none focus-visible:ring-0",
          "flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200",
          activeFilter === "read"
            ? "bg-green-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800/30 dark:hover:text-gray-100",
        )}
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
 * @param {function} handleToggleRead - 既読/未読を切り替える関数
 */
const NotificationItem = memo(function NotificationItem({
  notification,
  handleToggleRead,
}: {
  notification: NotificationData;
  handleToggleRead: (id: string, isRead: boolean) => void;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知の展開状態
   */
  const [isExpanded, setIsExpanded] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 既読/未読ボタンのクリック時の処理
   */
  const handleStatusButtonClick = useCallback(
    function handleStatusButtonClick(e: React.MouseEvent) {
      e.stopPropagation();
      handleToggleRead(notification.id, !notification.isRead);
    },
    [notification.id, notification.isRead, handleToggleRead],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 背景色のクラス
   */
  const backgroundClass = useMemo(
    function backgroundClass() {
      return notification.isRead
        ? "bg-white dark:bg-gray-800"
        : "bg-white dark:bg-gray-800/10 shadow-sm border-green-400";
    },
    [notification.isRead],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パディングのクラス
   */
  const paddingClass = "p-4";

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キーボードイベントの処理 (Enter または Space で展開/折りたたみ)
   */
  const handleKeyDown = useCallback(
    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); // ボタンとしてのデフォルトの動作（スクロールなど）を防ぐ
        setIsExpanded((prev) => !prev);
      }
    },
    [setIsExpanded],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div
      onClick={() => setIsExpanded((prev) => !prev)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      className={cn(
        "cursor-pointer overflow-hidden rounded-xl border transition-all duration-200",
        backgroundClass,
        paddingClass,
        isExpanded ? "h-auto" : "h-40",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex-grow overflow-hidden">
          <div className="flex items-start gap-4" aria-label={`通知: ${notification.title}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {notification.isRead ? (
                    <span className="invisible mt-1 h-2 w-2 flex-shrink-0" />
                  ) : (
                    <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-green-500" />
                  )}
                  <h4 className="truncate font-medium text-gray-900 dark:text-gray-100">{notification.title}</h4>
                </div>
                {notification.sentAt && (
                  <time
                    className="flex-shrink-0 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400"
                    dateTime={notification.sentAt.toISOString()}
                  >
                    {formatDistanceToNow(notification.sentAt, { addSuffix: true, locale: ja })}
                  </time>
                )}
              </div>
              <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                {notification.NotificationTargetType === "USER" && notification.senderUserId && (
                  <>
                    <span className="mr-1 flex-shrink-0">👤</span>
                    <span className="truncate">ユーザー: {notification.userName ?? notification.senderUserId}</span>
                  </>
                )}
                {notification.NotificationTargetType === "GROUP" && notification.groupId && (
                  <>
                    <span className="mr-1 flex-shrink-0">👥</span>
                    <span className="truncate">グループ: {notification.groupName ?? notification.groupId}</span>
                  </>
                )}
                {notification.NotificationTargetType === "TASK" && notification.taskId && (
                  <>
                    <span className="mr-1 flex-shrink-0">📋</span>
                    <span className="truncate">タスク: {notification.taskName ?? notification.taskId}</span>
                  </>
                )}
                {notification.NotificationTargetType === "SYSTEM" && (
                  <>
                    <span className="mr-1 flex-shrink-0">🔔</span>
                    <span>システム全体</span>
                  </>
                )}
                {notification.auctionEventType && (
                  <span className="ml-2 flex items-center truncate rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                    <ShoppingCart className="mr-1 inline-block h-3 w-3 flex-shrink-0" />
                    <span className="leading-none">
                      オークション: {formatAuctionEventType(notification.auctionEventType)}
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-2">
                <p
                  className={cn(
                    "text-sm text-gray-700 dark:text-gray-300",
                    isExpanded ? "whitespace-pre-wrap" : "truncate",
                  )}
                >
                  {notification.message}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {notification.actionUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
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
              variant="outline"
              size="sm"
              className={cn(
                "rounded-full px-3 text-xs",
                notification.isRead
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  : "bg-green-100 text-gray-800 hover:bg-green-200 dark:bg-green-700/30 dark:text-green-100 dark:hover:bg-green-700/50",
              )}
              onClick={handleStatusButtonClick}
            >
              {notification.isRead ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
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
      </div>
    </div>
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
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知が空の場合に表示するメッセージ
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex h-[300px] flex-col items-center justify-center">
      {!hasMore && <p className="mb-5 text-gray-500 dark:text-gray-400">{emptyMessage}</p>}

      {hasMore && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-48 rounded-full text-sm shadow-sm transition-all duration-200 hover:shadow"
          >
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
    <div className="mt-3 mb-1 flex items-center">
      <div className="flex h-9 items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        <button
          className={cn(
            "flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-all duration-200",
            activeAuctionFilter === "all"
              ? "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-100"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          )}
          onClick={() => onAuctionFilterChange("all")}
        >
          すべて
        </button>
        <button
          className={cn(
            "flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-all duration-200",
            activeAuctionFilter === "auction-only"
              ? "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-100"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          )}
          onClick={() => onAuctionFilterChange("auction-only")}
        >
          <ShoppingCart className="mr-1 h-3 w-3" />
          オークションのみ
        </button>
        <button
          className={cn(
            "flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium transition-all duration-200",
            activeAuctionFilter === "exclude-auction"
              ? "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-100"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
          )}
          onClick={() => onAuctionFilterChange("exclude-auction")}
        >
          <ShoppingCart className="mr-1 h-3 w-3" />
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
 * @param {function} handleToggleRead - 既読/未読を切り替える関数
 */
const Notifications = memo(function Notifications({
  notifications,
  readHasMore,
  unReadHasMore,
  isLoadingMore,
  activeFilter,
  loadMoreNotifications,
  handleToggleRead,
}: {
  notifications: NotificationData[];
  readHasMore: boolean;
  unReadHasMore: boolean;
  isLoadingMore: boolean;
  activeFilter: FilterType;
  loadMoreNotifications: () => void;
  handleToggleRead: (id: string, isRead: boolean) => void;
}) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const currentHasMore = useMemo(() => {
    if (activeFilter === "read") {
      return readHasMore;
    }
    if (activeFilter === "unread") {
      return unReadHasMore;
    }
    // "all" またはその他の場合
    return readHasMore || unReadHasMore;
  }, [activeFilter, readHasMore, unReadHasMore]);

  return (
    <div className="flex flex-col py-4">
      {notifications.length > 0 ? (
        <>
          <div className="space-y-4">
            {notifications.map((notification: NotificationData) => (
              <NotificationItem key={notification.id} notification={notification} handleToggleRead={handleToggleRead} />
            ))}
          </div>

          {currentHasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMoreNotifications}
                disabled={isLoadingMore}
                className="w-48 rounded-full text-sm shadow-sm transition-all duration-200 hover:shadow"
              >
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
        <NotificationsEmpty
          hasMore={currentHasMore}
          onLoadMore={loadMoreNotifications}
          isLoadingMore={isLoadingMore}
          activeFilter={activeFilter}
        />
      )}
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知リストコンポーネント
 * @param {function} onUnreadStatusChangeAction - 未読状態変更時のコールバック
 */
export const NotificationList = memo(function NotificationList() {
  const {
    notifications,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    unreadCount,
    readHasMore,
    unReadHasMore,
    activeFilter,
    activeAuctionFilter,
    markAllAsRead,
    handleFilterChange,
    handleAuctionFilterChange,
    handleManualRefresh,
    loadMoreNotifications,
    handleToggleRead,
  } = useNotificationList();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex flex-col">
      <div className="px-6">
        {/* フィルター */}
        <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} unreadCount={unreadCount} />

        {/* 手動更新ボタンとオークションフィルター */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            {/* 手動更新ボタン */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="ml-1 flex items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-xs transition-all duration-200 hover:bg-gray-200 hover:text-neutral-900 dark:border-neutral-200 dark:dark:border-neutral-800 dark:bg-gray-800 dark:dark:bg-neutral-800/30 dark:text-gray-300 dark:dark:hover:bg-neutral-800/50 dark:hover:bg-gray-700 dark:hover:text-neutral-50">
                  手動更新
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleManualRefresh}
                    className="ml-1 h-7 w-7 rounded-full px-3 text-xs font-medium text-gray-700 transition-all duration-200 dark:bg-gray-800 dark:text-gray-300"
                    title="手動更新"
                    disabled={isLoading || isRefreshing}
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </Button>
                </label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
                      aria-label="通知コマンドのヘルプ"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5}>
                    <div className="text-left text-xs">
                      <p className="mb-1 font-semibold">キーボードショートカット</p>
                      <ul className="list-inside list-disc space-y-2">
                        <li>
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Option
                          </kbd>{" "}
                          +{" "}
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            n
                          </kbd>{" "}
                          : 通知を開く
                        </li>
                        <li>
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            esc
                          </kbd>{" "}
                          : モーダーを閉じる
                        </li>
                        <li>
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Option
                          </kbd>{" "}
                          +{" "}
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            ←
                          </kbd>{" "}
                          : 前のフィルター
                        </li>
                        <li>
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Option
                          </kbd>{" "}
                          +{" "}
                          <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            →
                          </kbd>{" "}
                          : 次のフィルター
                        </li>
                      </ul>
                      <p className="mt-3 mb-1 font-semibold">注意点</p>
                      <ul className="mb-2 list-inside list-disc">
                        <li>通知の表示がバグっている場合は、「手動更新」ボタンで更新して下さい。</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* オークションフィルター */}
            <AuctionFilterControl
              activeAuctionFilter={activeAuctionFilter}
              onAuctionFilterChange={handleAuctionFilterChange}
            />
          </div>

          {/* 全て既読ボタン */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="self-center rounded-full px-3 text-xs font-medium text-gray-700 transition-all duration-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                すべて既読にする
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 通知リスト */}
      <div className="flex-1 px-6">
        {isLoading ? (
          <Loading />
        ) : error ? (
          <Error error={error} handleManualRefresh={handleManualRefresh} />
        ) : (
          <Notifications
            notifications={notifications}
            readHasMore={readHasMore ?? false}
            unReadHasMore={unReadHasMore ?? false}
            isLoadingMore={isLoadingMore}
            activeFilter={activeFilter}
            loadMoreNotifications={loadMoreNotifications}
            handleToggleRead={handleToggleRead}
          />
        )}
      </div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
