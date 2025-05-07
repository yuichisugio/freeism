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
 * @returns {NotificationManagerResult} 通知管理カスタムフックの返り値
 */
export function useNotificationList(): NotificationManagerResult {
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
      // updateNotificationStatus は複数の更新をまとめて処理できないため、個別に呼び出す
      const updatePromises = Array.from(currentPendingUpdates.entries()).map(([notificationId, isRead]) => {
        // updateNotificationStatus が単一のIDと状態を取る場合
        // return updateNotificationStatus(notificationId, isRead);

        // updateNotificationStatus が配列を受け取る場合（現在の use-notification-list.ts のように）
        // この関数は単一の更新を意図しているように見えるが、元のコードでは配列を渡している
        // ここでは updateNotificationStatus のシグネチャが (id: string, isRead: boolean) と仮定する
        // もし updateNotificationStatus が [{ notificationId: string, isRead: boolean }] を期待するなら修正が必要
        return updateNotificationStatus([{ notificationId, isRead }]);
      });

      // 保留中の更新をサーバーに同期
      await Promise.all(updatePromises);

      // 同期完了後、保留中の更新をクリア (Refを直接更新)
      pendingUpdatesRef.current = new Map();
      setPendingUpdateCount(0); // 保留中の更新数をリセット
      console.log("src/hooks/notification/use-notification-list.ts_syncWithServer_end");
    } catch (error) {
      console.error("[通知] 同期エラー:", error);
      // エラー発生時も保留中の更新をクリアすべきか検討。ここではクリアしない。
    }
  }, []); // 依存配列を空にする (setPendingUpdateCount は安定)

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知を取得する関数
   */
  const fetchNotifications = useCallback(async (page = 1, append = false) => {
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
        const sentAtDate = notification.sentAt ? new Date(notification.sentAt) : null;
        const validSentAt = sentAtDate instanceof Date && !isNaN(sentAtDate.getTime()) ? sentAtDate : null;

        return {
          ...notification,
          isRead: notification.isRead, // サーバーのisReadを初期値として尊重
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
      setNotifications((prevNotifications) => {
        let newNotificationsMap: Map<string, NotificationData>;

        if (append) {
          newNotificationsMap = new Map(prevNotifications.map((n) => [n.id, n]));
        } else {
          newNotificationsMap = new Map();
        }

        processedNotifications.forEach((fetchedNotification) => {
          // 新しく取得した通知にも保留中の変更を適用する可能性がある
          // ただし、通常は fetchNotifications はサーバーの最新状態を取得するので、
          // pendingUpdatesRef の内容を上書きする方が自然かもしれない。
          // ここでは、取得したデータをベースとし、pendingUpdatesRef は「これから同期されるべき変更」として扱う。
          // もし fetch 時に pending なものがあれば、サーバーの状態が優先される。
          // ユーザーがローカルで変更した後、サーバーから新しいデータが来た場合、
          // その新しいデータにローカルの isRead 状態を適用するかどうか。
          // 提供されたコードのロジックは、pending があればそれを優先するが、
          // fetch 時はサーバーデータを優先し、pending は別途適用するのがよさそう。
          // この実装では、サーバーから取得した isRead を使い、pending は別途適用される形になる。
          newNotificationsMap.set(fetchedNotification.id, fetchedNotification);
        });

        // マージ後、保留中の更新を適用（UI反映のため）
        pendingUpdatesRef.current.forEach((isRead, id) => {
          const notification = newNotificationsMap.get(id);
          if (notification) {
            newNotificationsMap.set(id, { ...notification, isRead, readAt: isRead ? new Date() : null });
          } else {
            // API結果に含まれないが保留中の更新がある場合
            // 古い通知に対する操作かもしれない。この場合、prevNotifications から探して状態を復元する。
            const prevNotification = prevNotifications.find((n) => n.id === id);
            if (prevNotification) {
              newNotificationsMap.set(id, { ...prevNotification, isRead, readAt: isRead ? new Date() : null });
            }
          }
        });

        const mergedNotifications = Array.from(newNotificationsMap.values()).sort((a, b) => {
          if (!a.sentAt && !b.sentAt) return 0;
          if (!a.sentAt) return 1;
          if (!b.sentAt) return -1;
          return b.sentAt.getTime() - a.sentAt.getTime();
        });

        console.log(`[通知] 読み込み後の通知数: ${mergedNotifications.length}`);
        return mergedNotifications;
      });

      setHasMore((result.totalCount ?? 0) > page * NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);
      setCurrentPage(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? `通知の取得に失敗しました: ${err.message}` : "通知の取得中にエラーが発生しました";
      setError(errorMessage);
      console.error("[通知] 取得エラー:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []); // setNotifications, setError, etc. は安定

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 追加データの読み込み
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

      // 既存の通知で、かつ状態が変わらない場合は何もしない
      const currentNotification = notifications.find((n) => n.id === id);
      if (currentNotification && currentNotification.isRead === isRead) {
        console.log(`[通知] ID=${id} の状態は既に ${isRead ? "既読" : "未読"} です。ローカル変更不要。`);
        // 保留中の変更も確認。もし保留中の変更があってそれが新しい状態と同じなら、保留リストから消すことも検討できる
        if (pendingUpdatesRef.current.has(id) && pendingUpdatesRef.current.get(id) === isRead) {
          // ここでpendingUpdatesRefから削除するロジックを追加してもよいが、syncWithServerで処理されるので必須ではない
        }
        return;
      }

      // 保留中の更新に追加 (Refを直接更新)
      const newPendingUpdates = new Map(pendingUpdatesRef.current);
      newPendingUpdates.set(id, isRead);
      pendingUpdatesRef.current = newPendingUpdates;
      setPendingUpdateCount(newPendingUpdates.size); // 保留中の更新数を更新

      setNotifications((prevNotifications) => {
        const targetIndex = prevNotifications.findIndex((n) => n.id === id);
        if (targetIndex === -1) return prevNotifications;

        const updatedNotification = { ...prevNotifications[targetIndex], isRead, readAt: isRead ? new Date() : null };
        const newNotifications = [...prevNotifications];
        newNotifications[targetIndex] = updatedNotification;
        return newNotifications;
      });
    },
    [notifications], // notifications は最新の状態を確認するために必要
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // すべての通知を既読にする
  const markAllAsRead = useCallback(() => {
    console.log("[通知] すべて既読にする");

    let changed = false;
    const updatedIds: string[] = [];

    setNotifications((prevNotifications) => {
      const newNotifications = prevNotifications.map((notification) => {
        if (!notification.isRead) {
          changed = true;
          updatedIds.push(notification.id);
          return { ...notification, isRead: true, readAt: new Date() };
        }
        return notification;
      });
      return changed ? newNotifications : prevNotifications;
    });

    if (changed) {
      console.log(`[通知] ${updatedIds.length} 件を既読にしました。`);
      const newPendingUpdates = new Map(pendingUpdatesRef.current);
      updatedIds.forEach((id) => {
        newPendingUpdates.set(id, true); // true = isRead
      });
      pendingUpdatesRef.current = newPendingUpdates;
      setPendingUpdateCount(newPendingUpdates.size);
    } else {
      console.log("[通知] 未読通知がないためスキップ");
    }
  }, []); // setNotifications, setPendingUpdateCount は安定

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター変更ハンドラー
  const handleFilterChange = useCallback(
    (filter: FilterType) => {
      console.log(`[通知] フィルター変更: ${filter}`);
      setActiveFilter(filter);

      // フィルター適用後の表示件数チェックと追加読み込みはuseEffectで行う
    },
    [], // setActiveFilter は安定
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションフィルター変更ハンドラー
  const handleAuctionFilterChange = useCallback(
    (filter: AuctionFilterType) => {
      console.log(`[通知] オークションフィルター変更: ${filter}`);
      setActiveAuctionFilter(filter);
      // フィルター適用後の表示件数チェックと追加読み込みはuseEffectで行う
    },
    [], // setActiveAuctionFilter は安定
  );

  // フィルター変更時に表示件数が少ない場合、追加データを読み込む
  useEffect(() => {
    // notifications, activeFilter, activeAuctionFilter のいずれかが変更されたときに評価
    const currentlyVisibleNotifications = filteredNotifications(); // 現在のフィルターを適用したリスト

    if (!isLoading && !isLoadingMore && currentlyVisibleNotifications.length < 5 && hasMore) {
      console.log("[通知] フィルター後の表示件数が少ないため、追加読み込み実行");
      loadMoreNotifications();
    }
  }, [notifications, activeFilter, activeAuctionFilter, isLoading, isLoadingMore, hasMore, loadMoreNotifications, filteredNotifications]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 手動更新ハンドラー
  const handleManualRefresh = useCallback(() => {
    // 手動更新の非同期処理
    const refreshAsync = async () => {
      console.log("src/hooks/notification/use-notification-list.ts_handleManualRefresh_start");
      setRequestCounter((prev) => prev + 1);

      if (pendingUpdatesRef.current.size > 0) {
        try {
          // 保留中の更新をサーバーと同期
          await syncWithServer();
        } catch (error) {
          console.error("[通知] 手動更新中の同期エラー:", error);
          // エラーが発生しても、通知の再取得は試みる
        } finally {
          // 同期試行後（成功・失敗問わず）に通知を再取得
          void fetchNotifications(1, false);
        }
      } else {
        // 保留中の更新がない場合は、通知を再取得
        void fetchNotifications(1, false);
      }
    };
    // 非同期処理を実行するが、この関数の返り値は void とする
    void refreshAsync();
  }, [syncWithServer, fetchNotifications, setRequestCounter]); // 変更: setRequestCounter を依存配列に追加

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 初期データ取得
  useEffect(() => {
    // isInitialRender.current が false の場合のみ実行 (初回レンダリング時)
    if (!isInitialRender.current) {
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_initial_fetch_start");
      void fetchNotifications(1, false); // 初期ページを読み込み
      isInitialRender.current = true; // 次回以降の再実行を防ぐ
    }

    // コンポーネントのクリーンアップ時に保留中の更新を同期
    return () => {
      if (pendingUpdatesRef.current.size > 0) {
        console.log("src/hooks/notification/use-notification-list.ts_useEffect_initial_fetch_cleanup_sync_start");
        // アンマウント時はバックグラウンドで実行 (await しない)
        void syncWithServer();
      }
    };
  }, [fetchNotifications, syncWithServer]); // fetchNotifications, syncWithServer は useCallback でメモ化

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // パス変更を検知して保留中の更新を同期
  useEffect(() => {
    // 初回レンダリング時は isInitialRender の useEffect で処理されるので、ここでは実行しない
    if (!isInitialRender.current || !pathname) return;

    console.log(`[通知] パス変更検知: ${pathname}`);
    console.log("src/hooks/notification/use-notification-list.ts_useEffect_pathname_change_start");

    if (pendingUpdatesRef.current.size > 0) {
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_pathname_change_sync_start");
      void syncWithServer();
    }
  }, [pathname, syncWithServer]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ブラウザタブの表示状態変更を検知して保留中の更新を同期
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && pendingUpdatesRef.current.size > 0) {
        console.log("[通知] タブ表示検知、保留中の更新を同期");
        void syncWithServer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    console.log("[通知] visibilitychange リスナー登録");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      console.log("[通知] visibilitychange リスナー解除");
      // アンマウントされる直前にも同期を試みる (タブが非表示のままアンマウントされるケースなど)
      if (pendingUpdatesRef.current.size > 0) {
        console.log("[通知] アンマウント前の最終同期 (visibilitychange cleanup)");
        void syncWithServer();
      }
    };
  }, [syncWithServer]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // notifications または pendingUpdateCount の変更を監視して未読数を更新
  useEffect(() => {
    console.log("src/hooks/notification/use-notification-list.ts_useEffect_updateUnreadCount_start");

    // 現在の通知リストと保留中の更新を考慮して未読数を計算
    let calculatedUnreadCount = 0;

    // まずリスト内の通知で未読のものをカウント
    notifications.forEach((n) => {
      // 保留中の変更で上書きされていないか確認
      const pendingStatus = pendingUpdatesRef.current.get(n.id);
      if (pendingStatus !== undefined) {
        // 保留中のステータスがある
        if (!pendingStatus) calculatedUnreadCount++; // 保留中が「未読」ならカウント
      } else {
        // 保留中のステータスがない
        if (!n.isRead) calculatedUnreadCount++; // 通知自体のステータスが「未読」ならカウント
      }
    });

    // notifications リストにはまだ存在しないが、pendingUpdatesRef に 'isRead: false' として存在するものを考慮
    // (例: 非常に古い通知を未読にした場合など。ただし、通常はnotificationsに含まれるはず)
    // このロジックは、notificationsがサーバーからのデータソースであり、pendingUpdatesがそれをオーバーライドするという前提
    // なので、上記で十分なはず。より厳密には全IDセットで回す。

    console.log(`[通知] 計算後の未読数: ${calculatedUnreadCount}`);
    setUnreadCount(calculatedUnreadCount);

    console.log("src/hooks/notification/use-notification-list.ts_useEffect_updateUnreadCount_end");
  }, [notifications, pendingUpdateCount]); // notifications, pendingUpdateCount に依存

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
    pendingUpdateCount,
  };
}
