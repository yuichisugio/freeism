"use client";

import type { FilterType, NotificationData } from "@/hooks/notification/use-notification-list";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationList } from "@/hooks/notification/use-notification-list";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, CheckCircle2, MoreHorizontal, RefreshCw } from "lucide-react";

/**
 * ローディングインジケーター
 */
function LoadingIndicator() {
  return <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />;
}

/**
 * フィルタータブコンポーネント
 */
function FilterTabs({ activeFilter, onFilterChange, unreadCount }: { activeFilter: FilterType; onFilterChange: (filter: FilterType) => void; unreadCount: number }) {
  return (
    <div className="sticky top-0 z-10 mb-3 flex border-b bg-white">
      <button
        onClick={() => onFilterChange("all")}
        className={activeFilter === "all" ? "border-b-2 border-blue-500 px-4 py-2 font-medium text-blue-600" : "px-4 py-2 font-medium text-gray-500 hover:text-gray-700"}
      >
        全て
      </button>
      <button
        onClick={() => onFilterChange("unread")}
        className={activeFilter === "unread" ? "border-b-2 border-blue-500 px-4 py-2 font-medium text-blue-600" : "px-4 py-2 font-medium text-gray-500 hover:text-gray-700"}
      >
        未読
        {unreadCount > 0 && <span className="ml-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
      </button>
      <button
        onClick={() => onFilterChange("read")}
        className={activeFilter === "read" ? "border-b-2 border-blue-500 px-4 py-2 font-medium text-blue-600" : "px-4 py-2 font-medium text-gray-500 hover:text-gray-700"}
      >
        既読
      </button>
    </div>
  );
}

/**
 * 通知アイテムコンポーネント
 */
function NotificationItem({ notification, onToggleReadStatus }: { notification: NotificationData; onToggleReadStatus: (id: string, isRead: boolean) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localIsRead, setLocalIsRead] = useState(notification.isRead);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (localIsRead !== notification.isRead) {
      setLocalIsRead(notification.isRead);
    }
  }, [notification.isRead, localIsRead]);

  function truncateMessage(message: string, maxLength = 50) {
    if (!message) return "";
    return message.length > maxLength ? message.substring(0, maxLength) + "..." : message;
  }

  function handleItemClick() {
    setIsExpanded((prev) => !prev);
  }

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
  }

  const backgroundClass = localIsRead ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-blue-950/20";

  const expandedPaddingClass = isExpanded ? "p-0" : "p-3";

  const expandedHeaderClass = isExpanded ? "border-b p-3" : "";

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

            <Button variant="ghost" size="sm" className="h-7 bg-gray-100 px-2 text-xs text-gray-500 hover:bg-gray-300" disabled={isProcessing} onClick={handleStatusButtonClick}>
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
}

/**
 * 通知が空の場合に表示するコンポーネント
 */
function NotificationsEmpty({ hasMore, onLoadMore, isLoadingMore, activeFilter }: { hasMore: boolean; onLoadMore: () => void; isLoadingMore: boolean; activeFilter: FilterType }) {
  let emptyMessage = "通知はありません";

  if (activeFilter === "unread") {
    emptyMessage = "未読の通知はありません";
  } else if (activeFilter === "read") {
    emptyMessage = "既読の通知はありません";
  }

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
}

/**
 * 通知リストコンポーネント
 * @param {function} onUnreadStatusChangeAction - 未読状態変更時のコールバック
 */
export function NotificationList({ onUnreadStatusChangeAction }: { onUnreadStatusChangeAction?: (hasUnread: boolean) => void }) {
  const {
    notifications,
    isLoading,
    isLoadingMore,
    error,
    unreadCount,
    hasMore,
    activeFilter,
    toggleReadStatus,
    loadMoreNotifications,
    markAllAsRead,
    handleFilterChange,
    handleManualRefresh,
    requestCounter,
  } = useNotificationList(onUnreadStatusChangeAction);

  return (
    <div className="flex flex-col overflow-hidden">
      {/* フィルタータブ - 固定 */}
      <FilterTabs activeFilter={activeFilter} onFilterChange={handleFilterChange} unreadCount={unreadCount} />

      {/* ヘッダー部分 - 固定 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-200">{unreadCount > 0 ? `${unreadCount}件の未読` : "未読はありません"}</span>
          <Button variant="ghost" size="icon" onClick={handleManualRefresh} className="h-7 w-7 rounded-full" title="手動更新">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {requestCounter > 0 && <span className="text-xs text-gray-500">リクエスト: {requestCounter}回</span>}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="bg-gray-100 text-xs text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
              すべて既読にする
            </Button>
          )}
        </div>
      </div>

      {/* 通知リスト部分 - スクロール可能エリア */}
      <div className="overflow-hidden">
        {isLoading ? (
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center">
              <div className="border-primary mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-sm text-gray-500">通知を読み込み中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-[50vh] items-center justify-center">
            <div className="text-center text-red-500">
              <AlertCircle className="mx-auto mb-2 h-6 w-6" />
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={handleManualRefresh}>
                再度読み込む
              </Button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
