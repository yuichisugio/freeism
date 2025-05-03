"use client";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getNotificationsAndUnreadCount, updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/auction/constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション通知フィルターの型
 */
export type AuctionFilterType = "all" | "auction-only" | "exclude-auction";

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
  sentAt: Date | null;
  readAt: Date | null;
  actionUrl: string | null;
  groupId: string | null;
  taskId: string | null;
  userName: string | null;
  groupName: string | null;
  taskName: string | null;
  expiresAt?: Date | null;
  senderUserId: string | null;
  auctionEventType: AuctionEventType | null;
  auctionId?: string | null;
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
  activeAuctionFilter: AuctionFilterType;
  toggleReadStatus: (id: string, isRead: boolean) => void;
  loadMoreNotifications: () => void;
  markAllAsRead: () => void;
  handleFilterChange: (filter: FilterType) => void;
  handleAuctionFilterChange: (filter: AuctionFilterType) => void;
  handleManualRefresh: () => void;
  requestCounter: number;
  pendingUpdateCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知管理カスタムフック
 * @param {Function} onUnreadStatusChangeAction - 未読通知の状態が変更された時に呼び出す関数
 * @returns {NotificationManagerResult} 通知管理カスタムフックの返り値
 */
export function useNotificationList(onUnreadStatusChangeAction?: (hasUnread: boolean) => void): NotificationManagerResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知の情報
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  // ローディング状態
  const [isLoading, setIsLoading] = useState(true);

  // 追加ローディングして取得できる情報があるかどうか
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // エラー情報
  const [error, setError] = useState<string | null>(null);

  // 未読通知のカウント
  const [unreadCount, setUnreadCount] = useState(0);

  // ページング情報
  const [currentPage, setCurrentPage] = useState(1);

  // 追加ローディングして取得できる情報があるかどうか
  const [hasMore, setHasMore] = useState(true);

  // フィルター情報
  const [activeFilter, setActiveFilter] = useState<FilterType>("unread");

  // オークションフィルター情報
  const [activeAuctionFilter, setActiveAuctionFilter] = useState<AuctionFilterType>("all");

  // APIリクエスト回数のカウンター
  const [requestCounter, setRequestCounter] = useState(0);

  // 保留中の更新を追跡 (useRefに変更)
  const pendingUpdatesRef = useRef<Map<string, boolean>>(new Map());

  // 保留中の更新数をstateで管理 (useEffectの依存配列用)
  const [pendingUpdateCount, setPendingUpdateCount] = useState(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター（パス変更監視用）
  const pathname = usePathname();

  const isInitialRender = useRef(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フィルター内容が変更された時に呼び出す
   */
  const filteredNotifications = useCallback(() => {
    // フィルターを適応した通知の情報
    let filtered = notifications;

    // 未読フィルターが適応された場合
    if (activeFilter === "unread") {
      filtered = filtered.filter((notification) => !notification.isRead);

      // 既読フィルターが適応された場合
    } else if (activeFilter === "read") {
      filtered = filtered.filter((notification) => notification.isRead);
    }

    // オークションのみ表示フィルターが適応された場合
    if (activeAuctionFilter === "auction-only") {
      filtered = filtered.filter((notification) => notification.auctionEventType !== null);

      // オークション除外フィルターが適応された場合
    } else if (activeAuctionFilter === "exclude-auction") {
      filtered = filtered.filter((notification) => notification.auctionEventType === null);
    }

    return filtered;
  }, [notifications, activeFilter, activeAuctionFilter]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サーバーに、既読/未読の通知のデータを更新する
   */
  const syncWithServer = useCallback(async () => {
    console.log("src/hooks/notification/use-notification-list.ts_syncWithServer_start");
    const currentPendingUpdates = pendingUpdatesRef.current; // 現在のRefの値を取得

    // 保留中の更新がない場合はスキップ
    if (currentPendingUpdates.size === 0) {
      console.log("src/hooks/notification/use-notification-list.ts_syncWithServer_skip");
      return;
    }

    console.log(`[通知] サーバー同期開始 (${currentPendingUpdates.size}件の更新)`);

    try {
      // 保留中の更新をサーバーに同期
      const updatePromises = Array.from(currentPendingUpdates.entries()).map(([notificationId, isRead]) => {
        return updateNotificationStatus(notificationId, isRead);
      });

      // 保留中の更新をサーバーに同期
      await Promise.all(updatePromises);

      // 同期完了後、保留中の更新をクリア (Refを直接更新)
      pendingUpdatesRef.current = new Map();
      setPendingUpdateCount(0); // 保留中の更新数をリセット
      console.log("src/hooks/notification/use-notification-list.ts_syncWithServer_end");

      // pendingUpdateCountを強制的に更新するためにstateを更新（任意）
      // このフックの利用側がpendingUpdateCountに依存している場合必要
      // setForceUpdateCounter(c => c + 1); // 例: forceUpdateCounterというstateを用意
    } catch (error) {
      console.error("[通知] 同期エラー:", error);
      // エラー発生時も保留中の更新をクリアすべきか検討。ここではクリアしない。
    }
  }, []); // 依存配列を空にする (setIsRequestInProgress, updateNotificationStatus は外部からのため)

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知を取得する関数
   */
  const fetchNotifications = useCallback(
    async (page = 1, append = false) => {
      console.log("src/hooks/notification/use-notification-list.ts_fetchNotifications_start");

      console.log(`[通知] データ取得開始 (ページ: ${page}, 追加: ${append})`);

      try {
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
        const processedNotifications: NotificationData[] = result.notifications.map((notification) => {
          // sentAtが有効な日付文字列でない場合はnullにする
          const sentAtDate = notification.sentAt ? new Date(notification.sentAt) : null;
          // Invalid Dateの場合はnullにする
          const validSentAt = sentAtDate instanceof Date && !isNaN(sentAtDate.getTime()) ? sentAtDate : null;

          return {
            ...notification,
            sentAt: validSentAt,
            readAt: notification.readAt ? new Date(notification.readAt) : null,
            expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : null,
            userName: notification.userName ?? null,
            groupName: notification.groupName ?? null,
            taskName: notification.taskName ?? null,
            senderUserId: notification.senderUserId ?? null,
            auctionEventType: notification.auctionEventType as AuctionEventType | null,
            auctionId: notification.auctionId ?? null,
          };
        });

        // 通知リストの更新
        if (append) {
          // 追加モード
          setNotifications((prevNotifications) => {
            const existingNotificationsMap = new Map(prevNotifications.map((n) => [n.id, n]));
            processedNotifications.forEach((notification) => {
              // ローカルで更新された通知は上書きしない (Refを参照)
              if (!pendingUpdatesRef.current.has(notification.id)) {
                existingNotificationsMap.set(notification.id, notification);
              }
            });
            const mergedNotifications = Array.from(existingNotificationsMap.values()).sort((a, b) => {
              if (!a.sentAt && !b.sentAt) return 0;
              if (!a.sentAt) return 1;
              if (!b.sentAt) return -1;
              return b.sentAt.getTime() - a.sentAt.getTime();
            });
            console.log(`[通知] 読み込み後の通知数: ${mergedNotifications.length} (重複排除後)`);
            return mergedNotifications;
          });
        } else {
          // 置換モード
          setNotifications((prevNotifications) => {
            const resultMap = new Map(processedNotifications.map((n) => [n.id, n]));
            // 保留中の更新があれば、そのステータスを優先 (Refを参照)
            pendingUpdatesRef.current.forEach((isRead, id) => {
              const notification = resultMap.get(id);
              if (notification) {
                resultMap.set(id, { ...notification, isRead, readAt: isRead ? new Date() : null });
              } else {
                // API結果に含まれないが保留中の更新がある場合 (例: 古い通知が既読にされた)
                // このケースをどう扱うか？ prevNotifications から探す？
                const prevNotification = prevNotifications.find((n) => n.id === id);
                if (prevNotification) {
                  resultMap.set(id, { ...prevNotification, isRead, readAt: isRead ? new Date() : null });
                }
              }
            });
            const finalNotifications = Array.from(resultMap.values()).sort((a, b) => {
              if (!a.sentAt && !b.sentAt) return 0;
              if (!a.sentAt) return 1;
              if (!b.sentAt) return -1;
              return b.sentAt.getTime() - a.sentAt.getTime();
            });
            return finalNotifications;
          });
        }

        setHasMore((result.totalCount || 0) > page * NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);
        setCurrentPage(page);

        // 親コンポーネントに未読状態を通知
        if (onUnreadStatusChangeAction) {
          onUnreadStatusChangeAction(result.unreadCount > 0);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? `通知の取得に失敗しました: ${err.message}` : "通知の取得中にエラーが発生しました";
        setError(errorMessage);
        console.error("[通知] 取得エラー:", err);
      } finally {
        // finallyブロックからsetTimeoutを削除
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    // 親コンポーネントで onUnreadStatusChangeAction がメモ化されていることを期待
    [onUnreadStatusChangeAction],
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

  // 既読/未読状態の切り替え
  const toggleReadStatus = useCallback(
    (id: string, isRead: boolean) => {
      console.log(`[通知] 状態変更: ID=${id}, 既読=${isRead}`);

      // 保留中の更新に追加 (Refを直接更新) - 先に更新しておく
      const newPendingUpdates = new Map(pendingUpdatesRef.current);
      newPendingUpdates.set(id, isRead);
      pendingUpdatesRef.current = newPendingUpdates;
      setPendingUpdateCount(newPendingUpdates.size); // 保留中の更新数を更新

      // setNotificationsのコールバック内でprevNotificationsを使用し、未読数も計算
      setNotifications((prevNotifications) => {
        const targetIndex = prevNotifications.findIndex((n) => n.id === id);
        if (targetIndex === -1) return prevNotifications; // 対象が見つからない場合は何もしない

        const updatedNotification = { ...prevNotifications[targetIndex], isRead, readAt: isRead ? new Date() : null };
        const newNotifications = [...prevNotifications];
        newNotifications[targetIndex] = updatedNotification;

        return newNotifications; // 更新された通知リストを返す
      });
    },
    // 依存配列をシンプルに
    [], // setNotifications, setPendingUpdateCount は安定
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // すべての通知を既読にする
  const markAllAsRead = useCallback(() => {
    console.log("[通知] すべて既読にする");

    let changed = false;
    const updatedIds: string[] = []; // 更新されたIDを追跡

    // setNotifications のコールバックを使用
    setNotifications((prevNotifications) => {
      const newNotifications = prevNotifications.map((notification) => {
        if (!notification.isRead) {
          changed = true; // 変更があったフラグ
          updatedIds.push(notification.id); // 更新されたIDを追加
          return { ...notification, isRead: true, readAt: new Date() };
        }
        return notification;
      });
      // 変更があった場合のみ state を更新
      return changed ? newNotifications : prevNotifications;
    });

    // 変更があった場合のみ実行
    if (changed) {
      console.log(`[通知] ${updatedIds.length} 件を既読にしました。`);
      // 未読カウント更新と親への通知は useEffect で行うため、ここでは直接更新しない

      // 保留中の更新に追加 (Refを直接更新)
      const newPendingUpdates = new Map(pendingUpdatesRef.current);
      updatedIds.forEach((id) => {
        newPendingUpdates.set(id, true); // true = isRead
      });
      pendingUpdatesRef.current = newPendingUpdates;
      setPendingUpdateCount(newPendingUpdates.size); // 保留中の更新数を更新

      // --- 未読数計算と親への通知を削除 -> useEffectに移動 ---
      // setUnreadCount(0);
      // if (onUnreadStatusChangeAction) {
      //   onUnreadStatusChangeAction(false);
      // }
      // --- ここまで削除 ---
    } else {
      console.log("[通知] 未読通知がないためスキップ");
    }
  }, []); // 依存配列を空にする (setNotifications, setPendingUpdateCount は安定)

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター変更ハンドラー
  const handleFilterChange = useCallback(
    (filter: FilterType) => {
      console.log(`[通知] フィルター変更: ${filter}`);
      setActiveFilter(filter);

      // フィルター適用後のリストを計算 (stateに依存しないように)
      setNotifications((currentNotifications) => {
        const visibleNotifications =
          filter === "all"
            ? currentNotifications
            : filter === "unread"
              ? currentNotifications.filter((n) => !n.isRead)
              : currentNotifications.filter((n) => n.isRead);

        // 表示件数が少なく、さらに読み込める場合
        if (visibleNotifications.length < 5 && hasMore) {
          void loadMoreNotifications();
        }
        return currentNotifications; // state自体は変更しない
      });
    },
    // notifications, isLoading, isLoadingMore を削除
    [hasMore, loadMoreNotifications], // isLoading, isLoadingMore は loadMoreNotifications 内部でチェックされる
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションフィルター変更ハンドラー
  const handleAuctionFilterChange = useCallback(
    (filter: AuctionFilterType) => {
      console.log(`[通知] オークションフィルター変更: ${filter}`);
      setActiveAuctionFilter(filter);

      // フィルター適用後のリストを計算 (stateに依存しないように)
      setNotifications((currentNotifications) => {
        let filtered = currentNotifications;
        // 適用するフィルター (activeFilter は state だが、この関数が再生成されるトリガーになるので OK)
        if (activeFilter === "unread") {
          filtered = filtered.filter((notification) => !notification.isRead);
        } else if (activeFilter === "read") {
          filtered = filtered.filter((notification) => notification.isRead);
        }
        // 適用するオークションフィルター (引数の filter を使用)
        if (filter === "auction-only") {
          filtered = filtered.filter((notification) => notification.auctionEventType !== null);
        } else if (filter === "exclude-auction") {
          filtered = filtered.filter((notification) => notification.auctionEventType === null);
        }

        if (filtered.length < 5 && hasMore) {
          void loadMoreNotifications();
        }
        return currentNotifications; // state自体は変更しない
      });
    },
    // filteredNotifications を削除し、activeFilter と notifications(setNotifications経由で取得) に依存
    [activeFilter, hasMore, loadMoreNotifications], // isLoading, isLoadingMore は loadMoreNotifications 内部でチェックされる
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 手動更新ハンドラー
  const handleManualRefresh = useCallback(() => {
    console.log("src/hooks/notification/use-notification-list.ts_handleManualRefresh_start");
    setRequestCounter((prev) => prev + 1);

    // 保留中の更新を同期 (Refを参照)
    if (pendingUpdatesRef.current.size > 0) {
      void syncWithServer();
    }

    // データを再取得
    void fetchNotifications(1, false);
  }, [syncWithServer, fetchNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 初期データ取得
  useEffect(() => {
    if (isInitialRender.current) return;
    isInitialRender.current = true;

    console.log("src/hooks/notification/use-notification-list.ts_useEffect_1_start");
    void fetchNotifications();

    // コンポーネントのクリーンアップ時に保留中の更新を同期
    return () => {
      if (pendingUpdatesRef.current.size > 0) {
        console.log("src/hooks/notification/use-notification-list.ts_useEffect_1_syncWithServer_start");
        void syncWithServer();
      }
    };
  }, [fetchNotifications, syncWithServer]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // パス変更を検知して保留中の更新を同期
  useEffect(() => {
    if (!pathname) return;

    console.log(`[通知] パス変更検知: ${pathname}`);
    console.log("src/hooks/notification/use-notification-list.ts_useEffect_2_start");

    if (pendingUpdatesRef.current.size > 0) {
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_2_syncWithServer_start");
      void syncWithServer();
    }
  }, [pathname, syncWithServer]); // pathname と syncWithServer (メモ化された関数) に依存

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ブラウザタブの表示状態変更を検知して保留中の更新を同期
  useEffect(() => {
    const handleVisibilityChange = () => {
      // タブが非表示になった && 保留中の更新がある場合
      if (document.visibilityState === "hidden" && pendingUpdatesRef.current.size > 0) {
        console.log("[通知] タブ非表示検知、保留中の更新を同期");
        void syncWithServer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    console.log("[通知] visibilitychange リスナー登録");

    // クリーンアップ関数
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      console.log("[通知] visibilitychange リスナー解除");
      // コンポーネントがアンマウントされる直前にも同期を試みる
      if (pendingUpdatesRef.current.size > 0) {
        console.log("[通知] アンマウント前の最終同期");
        void syncWithServer();
      }
    };
  }, [syncWithServer]); // syncWithServer は useCallback でメモ化されている

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // notifications または pendingUpdateCount の変更を監視して未読数を更新・通知する副作用
  useEffect(() => {
    console.log("src/hooks/notification/use-notification-list.ts_useEffect_updateUnreadCount_start");
    let currentUnread = 0;
    const currentNotificationsMap = new Map(notifications.map((n) => [n.id, n]));
    // 把握している全ての通知ID (リスト内のID + 保留中のID)
    const allRelevantIds = new Set([...notifications.map((n) => n.id), ...pendingUpdatesRef.current.keys()]);

    allRelevantIds.forEach((id) => {
      const pendingStatus = pendingUpdatesRef.current.get(id);
      const notification = currentNotificationsMap.get(id);
      let isEffectivelyRead: boolean;

      if (pendingStatus !== undefined) {
        // 保留中の更新がある場合、それを最優先
        isEffectivelyRead = pendingStatus;
      } else if (notification) {
        // 保留中の更新がなく、通知がリストに存在する場合、その状態を使用
        isEffectivelyRead = notification.isRead;
      } else {
        // 保留中の更新がなく、通知もリストにない場合 (sync後など、リストから消えた場合)
        // この通知はもう存在しないか既読として扱うのが妥当
        isEffectivelyRead = true; // 既読扱い
        console.warn(`[通知] 未読数計算: ID ${id} が notifications リストに見つかりません。既読として扱います。`);
      }

      if (!isEffectivelyRead) {
        currentUnread++;
      }
    });

    console.log(`[通知] 計算後の未読数: ${currentUnread}`);

    // 前回の未読数と比較し、変更があった場合のみ state 更新と親への通知を行う
    setUnreadCount((prevUnreadCount) => {
      if (prevUnreadCount !== currentUnread) {
        console.log(`[通知] 未読数を ${prevUnreadCount} -> ${currentUnread} に更新`);
        if (onUnreadStatusChangeAction) {
          console.log(`[通知] 親コンポーネントに通知 (未読あり: ${currentUnread > 0})`);
          onUnreadStatusChangeAction(currentUnread > 0);
        }
        return currentUnread; // 新しい未読数を返す
      }
      return prevUnreadCount; // 変更がない場合は既存の値を返す必要がある
    });

    console.log("src/hooks/notification/use-notification-list.ts_useEffect_updateUnreadCount_end");
  }, [notifications, pendingUpdateCount, onUnreadStatusChangeAction]); // notifications, pendingUpdateCount, コールバック関数に依存

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    notifications: filteredNotifications(),
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
    pendingUpdateCount, // stateから取得した値を返す
  };
}
