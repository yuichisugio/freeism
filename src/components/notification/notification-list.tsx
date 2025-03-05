"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiUpdateNotificationStatus, getNotificationsAndUnreadCount } from "@/app/actions/notification";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Bell, CheckCircle2, Info, MoreHorizontal, RefreshCw } from "lucide-react";

// 型定義
type NotificationType = "INFO" | "SUCCESS" | "WARNING";
type NotificationTargetType = "SYSTEM" | "USER" | "GROUP" | "TASK";
type FilterType = "all" | "unread" | "read";

export type NotificationData = {
  id: string;
  title: string;
  message: string;
  NotificationType: NotificationType;
  NotificationTargetType: NotificationTargetType;
  isRead: boolean;
  priority: number;
  sentAt: Date;
  readAt: Date | null;
  actionUrl: string | null;
  userId: string | null;
  groupId: string | null;
  taskId: string | null;
};

// 定数の定義（コンポーネント外で定義）
const ITEMS_PER_PAGE = 20;

/**
 * 通知管理カスタムフック
 */
function useNotificationManager(onUnreadStatusChangeAction?: (hasUnread: boolean) => void) {
  // 基本的な状態
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("unread");
  // APIリクエスト回数のカウンター
  const [requestCounter, setRequestCounter] = useState(0);

  // 保留中の更新を追跡
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, boolean>>(new Map());

  // データ取得中かどうかを追跡
  const [isRequestInProgress, setIsRequestInProgress] = useState(false);

  // 初期読み込みが完了したかどうか
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ルーター（パス変更監視用）
  const pathname = usePathname();

  // タブ変更でフィルター内容が変更された時に呼び出す
  const filteredNotifications = useCallback(() => {
    if (activeFilter === "all") {
      return notifications;
    }
    if (activeFilter === "unread") {
      return notifications.filter((notification) => !notification.isRead);
    }
    // 既読フィルター
    return notifications.filter((notification) => notification.isRead);
  }, [notifications, activeFilter]);

  // サーバーに、既読/未読の通知のデータを登録する
  const syncWithServer = useCallback(
    async (_force = false) => {
      if (pendingUpdates.size === 0) {
        console.log("[通知] 保留中の更新がないため同期スキップ");
        return;
      }

      console.log(`[通知] サーバー同期開始 (${pendingUpdates.size}件の更新)`);

      try {
        setIsRequestInProgress(true);
        const updatePromises = Array.from(pendingUpdates.entries()).map(([notificationId, isRead]) => {
          return apiUpdateNotificationStatus(notificationId, isRead);
        });

        await Promise.all(updatePromises);

        // 同期完了後、保留中の更新をクリア
        setPendingUpdates(new Map());
        console.log("[通知] サーバー同期完了");
      } catch (error) {
        console.error("[通知] 同期エラー:", error);
      } finally {
        setIsRequestInProgress(false);
      }
    },
    [pendingUpdates],
  );

  // 通知を取得する関数（初回のみ実行される）
  const fetchNotifications = useCallback(
    async (page = 1, append = false) => {
      // 初期ロードが完了していて、追加ロードでない場合は無視。apendは「もっと読み込む」ボタンによるアクセスを示す
      if (initialLoadDone && !append) {
        console.log("[通知] 初期ロード済みのため、通常の再読み込みをスキップ");
        return;
      }

      // リクエスト中は重複実行を防止
      if (isRequestInProgress) {
        console.log("[通知] リクエスト処理中のため、読み込みをスキップ");
        return;
      }

      console.log(`[通知] データ取得開始 (ページ: ${page}, 追加: ${append})`);

      try {
        setIsRequestInProgress(true);

        // ローディング状態の設定
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        setError(null);

        // APIからデータ取得
        const result = await getNotificationsAndUnreadCount(page, ITEMS_PER_PAGE);

        if (!result?.notifications) {
          throw new Error("APIからの応答が無効です");
        }

        // 通知データの正規化
        const processedNotifications = result.notifications.map((notification) => ({
          ...notification,
          sentAt: new Date(notification.sentAt),
          readAt: notification.readAt ? new Date(notification.readAt) : null,
        }));

        // 通知リストの更新
        if (append) {
          // 追加モード: 既存の通知IDのマップを作成
          const existingNotificationsMap = new Map(notifications.map((notification) => [notification.id, notification]));

          // 新しい通知を処理（重複を上書き）
          processedNotifications.forEach((notification) => {
            // ただし、既にローカルで更新された通知は上書きしない
            if (!pendingUpdates.has(notification.id)) {
              existingNotificationsMap.set(notification.id, notification);
            }
          });

          // マップから配列に戻して、sentAtの降順でソート
          const mergedNotifications = Array.from(existingNotificationsMap.values()).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

          setNotifications(mergedNotifications);
          console.log(`[通知] 読み込み後の通知数: ${mergedNotifications.length} (重複排除後)`);

          // 「もっと読み込む」以外の通知取得
        } else {
          // 置換モード: ただし、ローカルで更新されたものは保持
          const resultMap = new Map(processedNotifications.map((notification) => [notification.id, notification]));

          // 保留中の更新があれば、そのステータスを優先
          pendingUpdates.forEach((isRead, id) => {
            const notification = resultMap.get(id);
            if (notification) {
              resultMap.set(id, {
                ...notification,
                isRead: isRead,
                readAt: isRead ? new Date() : null,
              });
            }
          });

          // マップから配列に戻して、sentAtの降順でソート
          const finalNotifications = Array.from(resultMap.values()).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

          setNotifications(finalNotifications);
        }

        // 未読カウントを計算（保留中の更新を反映）
        let adjustedUnreadCount = result.unreadCount || 0;

        // 保留中の更新に基づいて未読カウントを調整
        pendingUpdates.forEach((isRead, id) => {
          const existingNotification = notifications.find((n) => n.id === id);
          if (existingNotification) {
            if (!existingNotification.isRead && isRead) {
              // 未読から既読に変更された
              adjustedUnreadCount = Math.max(0, adjustedUnreadCount - 1);
            } else if (existingNotification.isRead && !isRead) {
              // 既読から未読に変更された
              adjustedUnreadCount += 1;
            }
          }
        });

        setUnreadCount(adjustedUnreadCount);
        setHasMore((result.totalCount || 0) > page * ITEMS_PER_PAGE);
        setCurrentPage(page);

        // 初回読み込み完了をマーク
        setInitialLoadDone(true);

        // 親コンポーネントに未読状態を通知
        if (onUnreadStatusChangeAction) {
          onUnreadStatusChangeAction(adjustedUnreadCount > 0);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? `通知の取得に失敗しました: ${err.message}` : "通知の取得中にエラーが発生しました";

        setError(errorMessage);
        console.error("[通知] 取得エラー:", err);
      } finally {
        // 少し遅延させてから状態を更新（UI表示のため）
        setTimeout(() => {
          setIsLoading(false);
          setIsLoadingMore(false);
          setIsRequestInProgress(false);
        }, 300);
      }
    },
    [notifications, pendingUpdates, onUnreadStatusChangeAction, isRequestInProgress, initialLoadDone],
  );

  // 追加データの読み込み
  // 「もっと読み込む」ボタンを押した時に呼び出す関数。追加の通知データを取得するために使用する。pageに+1して、fetchNotificationsを呼び出す
  const loadMoreNotifications = useCallback(() => {
    if (isLoadingMore || !hasMore) {
      return;
    }
    fetchNotifications(currentPage + 1, true);
  }, [currentPage, fetchNotifications, hasMore, isLoadingMore]);

  // 既読/未読状態の切り替え。既読/未読ボタンを押した時に呼ばれる関数で、stateのnotificationsの通知のisReadを更新する
  const toggleReadStatus = useCallback(
    (id: string, isRead: boolean) => {
      console.log(`[通知] 状態変更: ID=${id}, 既読=${isRead}`);

      // 通知リストを更新
      setNotifications((prevNotifications) => {
        return prevNotifications.map((notification) => {
          if (notification.id === id) {
            return {
              ...notification,
              isRead: isRead,
              readAt: isRead ? new Date() : null,
            };
          }
          return notification;
        });
      });

      // 未読カウントを更新
      setUnreadCount((prevCount) => {
        const oldNotification = notifications.find((n) => n.id === id);
        const oldIsRead = oldNotification?.isRead ?? false;

        if (oldIsRead && !isRead) {
          // 既読→未読の場合、カウント増加
          return prevCount + 1;
        } else if (!oldIsRead && isRead) {
          // 未読→既読の場合、カウント減少
          return Math.max(0, prevCount - 1);
        }
        return prevCount;
      });

      // 保留中の更新に追加
      setPendingUpdates((prev) => {
        const newMap = new Map(prev);
        newMap.set(id, isRead);
        return newMap;
      });

      // 親コンポーネントに通知状態を報告
      if (onUnreadStatusChangeAction) {
        const currentUnreadCount = unreadCount;
        const updatedUnreadCount = isRead ? Math.max(0, currentUnreadCount - 1) : currentUnreadCount + 1;

        onUnreadStatusChangeAction(updatedUnreadCount > 0);
      }
    },
    [notifications, unreadCount, onUnreadStatusChangeAction],
  );

  // すべての通知を既読にする
  const markAllAsRead = useCallback(() => {
    console.log("[通知] すべて既読にする");

    // まず通知リストをローカルで更新
    const unreadNotifications = notifications.filter((n) => !n.isRead);

    if (unreadNotifications.length === 0) {
      console.log("[通知] 未読通知がないためスキップ");
      return;
    }

    // 未読通知を既読にする
    setNotifications((prevNotifications) => {
      return prevNotifications.map((notification) => {
        if (!notification.isRead) {
          return { ...notification, isRead: true, readAt: new Date() };
        }
        return notification;
      });
    });

    // 未読カウントをゼロにリセット
    setUnreadCount(0);

    // 保留中の更新に追加
    setPendingUpdates((prev) => {
      const newMap = new Map(prev);
      unreadNotifications.forEach((notification) => {
        newMap.set(notification.id, true);
      });
      return newMap;
    });

    // 親コンポーネントに通知
    if (onUnreadStatusChangeAction) {
      onUnreadStatusChangeAction(false);
    }
  }, [notifications, onUnreadStatusChangeAction]);

  // フィルター変更ハンドラー
  const handleFilterChange = useCallback(
    (filter: FilterType) => {
      console.log(`[通知] フィルター変更: ${filter}`);
      setActiveFilter(filter);

      // フィルター変更時、特に「未読のみ」「既読のみ」に切り替えた場合、
      // 表示される通知が少ない場合は追加で読み込む
      const visibleNotifications =
        filter === "all" ? notifications : filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications.filter((n) => n.isRead);

      if (visibleNotifications.length < 5 && hasMore && !isLoading && !isLoadingMore) {
        loadMoreNotifications();
      }
    },
    [notifications, hasMore, isLoading, isLoadingMore, loadMoreNotifications],
  );

  // 手動更新ハンドラー
  const handleManualRefresh = useCallback(() => {
    console.log("[通知] 手動更新");
    setRequestCounter((prev) => prev + 1);

    // 保留中の更新を同期
    if (pendingUpdates.size > 0) {
      syncWithServer(true);
    }

    // 初期ロードフラグをリセット
    setInitialLoadDone(false);

    // データを再取得
    fetchNotifications(1, false);
  }, [pendingUpdates, syncWithServer, fetchNotifications]);

  // 初期データ取得
  useEffect(() => {
    console.log("[通知] 初期データ取得");
    fetchNotifications();

    // コンポーネントのクリーンアップ時に保留中の更新を同期
    return () => {
      if (pendingUpdates.size > 0) {
        syncWithServer(true);
      }
    };
  }, [fetchNotifications, pendingUpdates.size, syncWithServer]);

  // パス変更を検知して保留中の更新を同期
  useEffect(() => {
    if (!pathname) return;

    console.log(`[通知] パス変更検知: ${pathname}`);

    // 非同期関数を即時実行
    const syncOnPathChange = async () => {
      if (pendingUpdates.size > 0) {
        console.log("[通知] パス変更時の同期実行");
        await syncWithServer(true);
      }
    };

    syncOnPathChange();

    // 依存配列にpathname追加
  }, [pathname, pendingUpdates, syncWithServer]);

  // クリーンアップ時に保留中の更新を同期
  useEffect(() => {
    return () => {
      if (pendingUpdates.size > 0) {
        syncWithServer(true);
      }
    };
  }, [pendingUpdates.size, syncWithServer]);

  return {
    notifications: filteredNotifications(),
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
    pendingUpdateCount: pendingUpdates.size,
  };
}

// 通知アイコンコンポーネント
function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === "INFO") {
    return <Info className="h-4 w-4 text-blue-500" />;
  }
  if (type === "SUCCESS") {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
  if (type === "WARNING") {
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  }

  return <Bell className="h-4 w-4" />;
}

// 優先度表示コンポーネント
function PriorityStars({ priority }: { priority: number }) {
  const stars = Math.min(5, Math.max(1, Math.round(priority)));

  return (
    <div className="mt-0.5 flex items-center gap-0.5" title={`優先度: ${stars}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={`star-${i}`} className={i < stars ? "text-xs text-yellow-500" : "text-xs text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

// ローディングインジケーター
function LoadingIndicator() {
  return <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />;
}

// フィルタータブコンポーネント
function FilterTabs({
  activeFilter,
  onFilterChange,
  unreadCount,
}: {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  unreadCount: number;
}) {
  return (
    <div className="mb-3 flex border-b">
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
}

// 通知アイテムコンポーネント
function NotificationItem({
  notification,
  onToggleReadStatus,
}: {
  notification: NotificationData;
  onToggleReadStatus: (id: string, isRead: boolean) => void;
}) {
  // アクションURL用に残しておく
  // const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localIsRead, setLocalIsRead] = useState(notification.isRead);
  const [isProcessing, setIsProcessing] = useState(false);

  // notification.isReadが変更された場合にローカル状態を更新
  useEffect(() => {
    if (localIsRead !== notification.isRead) {
      setLocalIsRead(notification.isRead);
    }
  }, [notification.isRead, localIsRead]);

  // メッセージの省略表示
  function truncateMessage(message: string, maxLength: number = 50) {
    if (!message) return "";
    return message.length > maxLength ? message.substring(0, maxLength) + "..." : message;
  }

  // 通知クリック時
  function handleItemClick() {
    setIsExpanded((prev) => !prev);
  }

  // 既読/未読切り替え
  function handleStatusButtonClick(e: React.MouseEvent) {
    e.stopPropagation();

    if (isProcessing) {
      return;
    }

    const newStatus = !localIsRead;
    setIsProcessing(true);
    setLocalIsRead(newStatus);
    onToggleReadStatus(notification.id, newStatus);

    // UI表示のための短い遅延
    setTimeout(() => setIsProcessing(false), 300);
  }

  // 背景色の決定
  const backgroundClass = localIsRead ? "bg-gray-50 dark:bg-gray-800/50" : "bg-white dark:bg-blue-950/20";

  // 展開スタイルの決定
  const expandedPaddingClass = isExpanded ? "p-0" : "p-3";

  // 展開時のヘッダースタイル
  const expandedHeaderClass = isExpanded ? "border-b p-3" : "";

  return (
    <li className={`flex flex-col rounded-lg border transition-colors ${backgroundClass} ${expandedPaddingClass}`}>
      <div className={`flex cursor-pointer items-start gap-3 ${expandedHeaderClass}`} onClick={handleItemClick}>
        <div className="mt-1">
          <NotificationIcon type={notification.NotificationType} />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold">{notification.title}</h4>
              {notification.priority > 0 && <PriorityStars priority={notification.priority} />}
            </div>
            <time className="text-xs text-gray-500" dateTime={notification.sentAt.toISOString()}>
              {formatDistanceToNow(notification.sentAt, { addSuffix: true, locale: ja })}
            </time>
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
}

// 通知なしコンポーネント
function NotificationsEmpty({
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

// メイン通知リストコンポーネント
export function NotificationList({ onUnreadStatusChangeAction }: { onUnreadStatusChangeAction?: (hasUnread: boolean) => void }) {
  // カスタムフックを使用して通知関連の状態と関数を取得
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
  } = useNotificationManager(onUnreadStatusChangeAction);

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
          <ScrollArea className="h-[60vh]">
            <div className="flex flex-col gap-4 pr-4">
              {notifications.length > 0 ? (
                <>
                  <ul className="space-y-3">
                    {notifications.map((notification) => (
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
