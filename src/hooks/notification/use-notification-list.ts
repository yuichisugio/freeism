"use client";

import type { NotificationTargetType } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiUpdateNotificationStatus, getNotificationsAndUnreadCount } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/auction/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知フィルターの型
 */
export type FilterType = "all" | "unread" | "read";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知データの型
 */
export type NotificationData = {
  id: string;
  title: string;
  message: string;
  NotificationTargetType: NotificationTargetType;
  isRead: boolean;
  sentAt: Date;
  readAt: Date | null;
  actionUrl: string | null;
  groupId: string | null;
  taskId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
  expiresAt?: Date | null;
  senderUserId: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知管理カスタムフックの返り値の型
 */
export type NotificationManagerResult = {
  notifications: NotificationData[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  unreadCount: number;
  hasMore: boolean;
  activeFilter: FilterType;
  toggleReadStatus: (id: string, isRead: boolean) => void;
  loadMoreNotifications: () => void;
  markAllAsRead: () => void;
  handleFilterChange: (filter: FilterType) => void;
  handleManualRefresh: () => void;
  requestCounter: number;
  pendingUpdateCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知管理カスタムフック
 */
export function useNotificationList(onUnreadStatusChangeAction?: (hasUnread: boolean) => void): NotificationManagerResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター（パス変更監視用）
  const pathname = usePathname();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
        const result = await getNotificationsAndUnreadCount(page, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);

        if (!result?.notifications) {
          throw new Error("APIからの応答が無効です");
        }

        // 通知データの正規化
        const processedNotifications: NotificationData[] = result.notifications.map((notification) => ({
          ...notification,
          sentAt: new Date(notification.sentAt),
          readAt: notification.readAt ? new Date(notification.readAt) : null,
          expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : null,
          userName: notification.userName ?? null,
          groupName: notification.groupName ?? null,
          taskName: notification.taskName ?? null,
          senderUserId: notification.senderUserId ?? null,
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
        setHasMore((result.totalCount || 0) > page * NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 追加データの読み込み
  // 「もっと読み込む」ボタンを押した時に呼び出す関数。追加の通知データを取得するために使用する。pageに+1して、fetchNotificationsを呼び出す
  const loadMoreNotifications = useCallback(() => {
    if (isLoadingMore || !hasMore) {
      return;
    }
    void fetchNotifications(currentPage + 1, true);
  }, [currentPage, fetchNotifications, hasMore, isLoadingMore]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター変更ハンドラー
  const handleFilterChange = useCallback(
    (filter: FilterType) => {
      console.log(`[通知] フィルター変更: ${filter}`);
      setActiveFilter(filter);

      // フィルター変更時、特に「未読のみ」「既読のみ」に切り替えた場合、
      // 表示される通知が少ない場合は追加で読み込む
      const visibleNotifications = filter === "all" ? notifications : filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications.filter((n) => n.isRead);

      if (visibleNotifications.length < 5 && hasMore && !isLoading && !isLoadingMore) {
        void loadMoreNotifications();
      }
    },
    [notifications, hasMore, isLoading, isLoadingMore, loadMoreNotifications],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 手動更新ハンドラー
  const handleManualRefresh = useCallback(() => {
    console.log("[通知] 手動更新");
    setRequestCounter((prev) => prev + 1);

    // 保留中の更新を同期
    if (pendingUpdates.size > 0) {
      void syncWithServer(true);
    }

    // 初期ロードフラグをリセット
    setInitialLoadDone(false);

    // データを再取得
    void fetchNotifications(1, false);
  }, [pendingUpdates, syncWithServer, fetchNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 初期データ取得
  useEffect(() => {
    console.log("[通知] 初期データ取得");
    void fetchNotifications();

    // コンポーネントのクリーンアップ時に保留中の更新を同期
    return () => {
      if (pendingUpdates.size > 0) {
        void syncWithServer(true);
      }
    };
  }, [fetchNotifications, pendingUpdates.size, syncWithServer]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

    // 明示的にPromiseをvoid演算子で無視する
    void syncOnPathChange();

    // 依存配列にpathname追加
  }, [pathname, pendingUpdates, syncWithServer]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // クリーンアップ時に保留中の更新を同期
  useEffect(() => {
    return () => {
      if (pendingUpdates.size > 0) {
        void syncWithServer(true);
      }
    };
  }, [pendingUpdates.size, syncWithServer]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
