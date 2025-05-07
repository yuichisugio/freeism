"use client";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getNotificationsAndUnreadCount, updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/auction/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション通知フィルターの型
 */
export type AuctionFilterType = "all" | "auction-only" | "exclude-auction";

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
  markAllAsRead: () => void;
  handleFilterChange: (filter: FilterType) => void;
  handleAuctionFilterChange: (filter: AuctionFilterType) => void;
  handleManualRefresh: () => void;
  loadMoreNotifications: () => void;
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

  // QueryClient の取得
  const queryClient = useQueryClient();

  // ルーター（パス変更監視用）
  const pathname = usePathname();

  const isInitialRender = useRef(false);

  const session = useSession();
  const userId = session.data?.user?.id;

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
   * サーバーに保留中の既読/未読ステータスを同期するための useMutation
   */
  const { mutate: syncNotificationsMutate, mutateAsync: syncNotificationsMutateAsync } = useMutation<
    void, // 成功時の返り値の型 (void)
    Error, // エラーの型
    Map<string, boolean> // mutate 関数に渡す引数の型 (pendingUpdates)
  >({
    onMutate: () => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_onMutate");
    },
    mutationFn: async (pendingUpdates: Map<string, boolean>) => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_start");

      if (pendingUpdates.size === 0) {
        return;
      }

      const updatePromises = Array.from(pendingUpdates.entries()).map(async ([notificationId, isRead]) => {
        return await updateNotificationStatus([{ notificationId, isRead }]);
      });
      await Promise.all(updatePromises);
    },
    onSuccess: (_data, pendingUpdates: Map<string, boolean>) => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_success");

      queryClient.setQueriesData<{ notifications: NotificationData[]; totalCount: number }>(
        { queryKey: ["notifications"], exact: false },
        (oldData) => {
          if (!oldData) return undefined;
          const newNotifications = oldData.notifications.map((notification) => {
            if (pendingUpdates.has(notification.id)) {
              const isRead = pendingUpdates.get(notification.id)!;
              return { ...notification, isRead, readAt: isRead ? new Date() : null };
            }
            return notification;
          });
          return { ...oldData, notifications: newNotifications };
        },
      );

      pendingUpdatesRef.current.clear();
      setPendingUpdateCount(pendingUpdatesRef.current.size);
      console.log("[通知] サーバー同期成功、保留リストクリア、キャッシュ直接更新");
    },
    onError: (error) => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_error");
      console.error("[通知] 同期エラー (ミューテーション):", error);
    },
    onSettled: async () => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_settled");
      await queryClient.invalidateQueries({ queryKey: ["notifications"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
      await queryClient.invalidateQueries({ queryKey: ["notifications", currentPage, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE] });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * TanStack Query を使用した通知取得
   */
  const {
    data: notificationsData,
    isLoading: queryIsLoading,
    isFetching: queryIsFetching,
    error: queryError,
  } = useQuery<
    { notifications: NotificationData[]; totalCount: number },
    Error,
    { notifications: NotificationData[]; totalCount: number },
    readonly [string, number, number]
  >({
    queryKey: ["notifications", currentPage, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE],
    queryFn: async (): Promise<{ notifications: NotificationData[]; totalCount: number }> => {
      console.log("src/hooks/notification/use-notification-list.ts_useQuery_fetchNotifications_start");

      const result = await getNotificationsAndUnreadCount(currentPage, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);

      const processedNotifications: NotificationData[] = result.notifications.map((notification) => {
        const sentAtDate = notification.sentAt ? new Date(notification.sentAt) : null;
        const validSentAt = sentAtDate instanceof Date && !isNaN(sentAtDate.getTime()) ? sentAtDate : null;
        return {
          ...notification,
          isRead: notification.isRead,
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
      return { notifications: processedNotifications, totalCount: result.totalCount ?? 0 };
    },
    refetchOnMount: "always", // コンポーネントマウント時に常に再フェッチして、通知を開いたら最新の通知を取得
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useQuery から取得したデータを notifications state に反映する
  useEffect(() => {
    if (notificationsData) {
      const { notifications: fetchedItems, totalCount } = notificationsData;

      setNotifications((prevNotifications) => {
        let newNotificationsMap: Map<string, NotificationData>;

        if (currentPage === 1) {
          // 最初のページまたはリフレッシュの場合
          newNotificationsMap = new Map();
        } else {
          // 追加読み込みの場合
          newNotificationsMap = new Map(prevNotifications.map((n) => [n.id, n]));
        }

        fetchedItems.forEach((fetchedNotification: NotificationData) => {
          newNotificationsMap.set(fetchedNotification.id, fetchedNotification);
        });

        pendingUpdatesRef.current.forEach((isRead, id) => {
          const notification = newNotificationsMap.get(id);
          if (notification) {
            newNotificationsMap.set(id, { ...notification, isRead, readAt: isRead ? new Date() : null });
          } else {
            const prevNotification = prevNotifications.find((n) => n.id === id);
            if (prevNotification && currentPage !== 1) {
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

      setHasMore(totalCount > currentPage * NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);

      // isInitialRender の更新: 最初のデータ取得が完了したことを示す
      if (!isInitialRender.current && currentPage === 1 && fetchedItems.length > 0) {
        console.log("src/hooks/notification/use-notification-list.ts_useEffect_queryData_initial_fetch_complete");
        isInitialRender.current = true;
      }
    }
  }, [notificationsData, currentPage, pendingUpdateCount]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 既読/未読状態の切り替え
  const toggleReadStatus = useCallback(
    (id: string, isRead: boolean) => {
      console.log(`[通知] 状態変更: ID=${id}, 既読=${isRead}`);

      // 既存の通知で、かつ状態が変わらない場合は何もしない
      const currentNotification = notifications.find((n) => n.id === id);
      if (currentNotification && currentNotification.isRead === isRead) {
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
    [notifications],
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
      const newPendingUpdates = new Map(pendingUpdatesRef.current);
      updatedIds.forEach((id) => {
        newPendingUpdates.set(id, true); // true = isRead
      });
      pendingUpdatesRef.current = newPendingUpdates;
      setPendingUpdateCount(newPendingUpdates.size);
    } else {
      console.log("[通知] 未読通知がないためスキップ");
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター変更ハンドラー
  const handleFilterChange = useCallback((filter: FilterType) => {
    console.log(`[通知] フィルター変更: ${filter}`);
    setActiveFilter(filter);
  }, []);

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 手動更新ハンドラー
  const handleManualRefresh = useCallback(() => {
    // 手動更新の非同期処理
    const refreshAsync = async () => {
      console.log("src/hooks/notification/use-notification-list.ts_handleManualRefresh_start");
      setRequestCounter((prev) => prev + 1);

      if (pendingUpdatesRef.current.size > 0) {
        try {
          // 保留中の更新をサーバーと同期 (useMutation を使用)
          await syncNotificationsMutateAsync(new Map(pendingUpdatesRef.current)); // 現在の保留内容を渡す
        } catch (err) {
          console.error("[通知] 手動更新中の同期エラー:", err);
        }
      }
      if (currentPage === 1) {
        console.log("[通知] 手動更新: 1ページ目を再取得 (invalidate)");
        await queryClient.invalidateQueries({ queryKey: ["notifications", 1, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE] as const });
      } else {
        console.log("[通知] 手動更新: 1ページ目に遷移して取得");
        setCurrentPage(1);
      }
    };
    void refreshAsync();
  }, [syncNotificationsMutateAsync, queryClient, currentPage, setCurrentPage, setRequestCounter]); // syncMutation を依存配列に追加

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // パス変更を検知して保留中の更新を同期
  useEffect(() => {
    // 初回レンダリング時は isInitialRender の useEffect で処理されるので、ここでは実行しない
    if (!isInitialRender.current || !pathname) return;

    console.log(`[通知] パス変更検知: ${pathname}`);
    console.log("src/hooks/notification/use-notification-list.ts_useEffect_pathname_change_start");

    if (pendingUpdatesRef.current.size > 0) {
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_pathname_change_sync_start");
      void syncNotificationsMutate(new Map(pendingUpdatesRef.current)); // 非同期で実行、現在の保留内容を渡す
    }
  }, [pathname, syncNotificationsMutate, isInitialRender]); // isInitialRender を依存配列に追加 (useRefのため効果はないが意図を示す)

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ブラウザタブの表示状態変更を検知して保留中の更新を同期
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && pendingUpdatesRef.current.size > 0) {
        console.log("[通知] タブ非表示検知、保留中の更新を同期");
        void syncNotificationsMutate(new Map(pendingUpdatesRef.current)); // 非同期で実行
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    console.log("[通知] visibilitychange リスナー登録");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      console.log("[通知] visibilitychange リスナー解除");
      if (pendingUpdatesRef.current.size > 0) {
        console.log("[通知] アンマウント前の最終同期 (visibilitychange cleanup)");
        void syncNotificationsMutate(new Map(pendingUpdatesRef.current)); // 非同期で実行
      }
    };
  }, [syncNotificationsMutate]); // syncMutation を依存配列に追加

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
    console.log(`[通知] 計算後の未読数: ${calculatedUnreadCount}`);
    setUnreadCount(calculatedUnreadCount);

    console.log("src/hooks/notification/use-notification-list.ts_useEffect_updateUnreadCount_end");
  }, [notifications, pendingUpdateCount]); // notifications, pendingUpdateCount に依存

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 追加の通知を読み込む関数
  const loadMoreNotifications = useCallback(() => {
    if (hasMore && !queryIsFetching) {
      console.log("[通知] 追加読み込み実行");
      setCurrentPage((prevPage) => prevPage + 1);
    }
  }, [hasMore, queryIsFetching, setCurrentPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // isLoading, isLoadingMore, error を useQuery の状態から派生
  const derivedIsLoading = queryIsLoading && currentPage === 1 && notifications.length === 0; // 初回ロード中
  const derivedIsLoadingMore = queryIsFetching && currentPage > 1;
  const derivedError = queryError
    ? queryError instanceof Error
      ? `通知の取得に失敗しました: ${queryError.message}`
      : "通知の取得中にエラーが発生しました"
    : null;

  return {
    notifications: filteredNotifications(),
    isLoading: derivedIsLoading,
    isLoadingMore: derivedIsLoadingMore,
    error: derivedError,
    unreadCount,
    hasMore,
    activeFilter,
    activeAuctionFilter,
    toggleReadStatus,
    markAllAsRead,
    handleFilterChange,
    handleAuctionFilterChange,
    handleManualRefresh,
    loadMoreNotifications,
    requestCounter,
    pendingUpdateCount,
  };
}
