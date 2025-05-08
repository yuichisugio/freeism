"use client";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getNotificationsAndUnreadCount, updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/auction/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** オークション通知フィルターの型 */
export type AuctionFilterType = "all" | "auction-only" | "exclude-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** 通知フィルターの型 */
export type FilterType = "all" | "unread" | "read";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** 通知データの型 */
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

/** 通知管理カスタムフックの返り値の型 */
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
  pendingUpdateCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知管理カスタムフック
 * @returns {NotificationManagerResult} 通知管理カスタムフックの返り値
 */
export function useNotificationList(): NotificationManagerResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 全ての取得済み通知を保持するstate
  const [allNotifications, setAllNotifications] = useState<NotificationData[]>([]);

  // 未読通知のカウント (これは全体の未読数を表示するために別途利用)
  const [overallUnreadCount, setOverallUnreadCount] = useState(0);

  // 追加ローディングして取得できる情報があるかどうか (フィルターごとに管理)
  const [hasMore, setHasMore] = useState(true); // 初期値はtrueにしておく

  // フィルター情報
  const [activeFilter, setActiveFilter] = useState<FilterType>("unread");
  const [currentPageByFilter, setCurrentPageByFilter] = useState<Record<FilterType, number>>({
    all: 1,
    unread: 1,
    read: 1,
  });

  // オークションフィルター情報
  const [activeAuctionFilter, setActiveAuctionFilter] = useState<AuctionFilterType>("all");

  // 保留中の更新を追跡 (useRefに変更)
  const pendingUpdatesRef = useRef<Map<string, boolean>>(new Map());

  // 保留中の更新数をstateで管理 (useEffectの依存配列用)
  const [pendingUpdateCount, setPendingUpdateCount] = useState(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // QueryClient の取得
  const queryClient = useQueryClient();

  // ルーター（パス変更監視用）
  const pathname = usePathname();

  // セッション情報
  const session = useSession();
  const userId = session.data?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** 表示用の通知リストを生成する。allNotifications state を元に、現在のアクティブフィルターとオークションフィルターを適用する。 */
  const filteredNotificationsForDisplay = useCallback(() => {
    let filtered = [...allNotifications]; // 全通知のコピーから開始

    // isRead フィルター適用
    if (activeFilter === "unread") {
      filtered = filtered.filter((notification) => !notification.isRead);
    } else if (activeFilter === "read") {
      filtered = filtered.filter((notification) => notification.isRead);
    }

    // オークションフィルター適用
    if (activeAuctionFilter === "auction-only") {
      filtered = filtered.filter((notification) => notification.auctionEventType !== null);
    } else if (activeAuctionFilter === "exclude-auction") {
      filtered = filtered.filter((notification) => notification.auctionEventType === null);
    }

    // sentAt でソート (常に最新が上に来るように)
    filtered.sort((a, b) => {
      if (!a.sentAt && !b.sentAt) return 0;
      if (!a.sentAt) return 1;
      if (!b.sentAt) return -1;
      // Dateオブジェクトに変換してから比較
      const dateA = new Date(a.sentAt).getTime();
      const dateB = new Date(b.sentAt).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [allNotifications, activeFilter, activeAuctionFilter]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** サーバーに保留中の既読/未読ステータスを同期するための useMutation */
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

      if (pendingUpdates.size === 0 || !userId) {
        // userId チェック追加
        return;
      }

      const updatePromises = Array.from(pendingUpdates.entries()).map(([notificationId, isRead]) => ({ notificationId, isRead }));
      await updateNotificationStatus(updatePromises);
    },
    onSuccess: async (_data, pendingUpdates: Map<string, boolean>) => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_success");

      let unreadCountDelta = 0;
      // 1. allNotifications を即時更新してUIに反映 (オプティミスティック更新)
      //    この時点では pendingUpdates に基づいてローカルのビューを更新する
      setAllNotifications((prevNotifications) =>
        prevNotifications.map((notification) => {
          if (pendingUpdates.has(notification.id)) {
            const newIsRead = pendingUpdates.get(notification.id)!;
            // 未読数の変動を計算 (オプティミスティック更新のため)
            // この計算は、サーバー同期前のローカル状態に基づいて行う
            if (notification.isRead && !newIsRead) {
              // 既読から未読へ
              unreadCountDelta++;
            } else if (!notification.isRead && newIsRead) {
              // 未読から既読へ
              unreadCountDelta--;
            }
            return { ...notification, isRead: newIsRead, readAt: newIsRead ? new Date() : null };
          }
          return notification;
        }),
      );

      // 2. overallUnreadCount をオプティミスティックに更新
      //    サーバーからの最新の未読数は、後続のクエリ無効化と再フェッチによって反映される
      if (unreadCountDelta !== 0) {
        setOverallUnreadCount((prev) => Math.max(0, prev + unreadCountDelta));
      }

      // 3. 保留中の更新をクリア
      pendingUpdatesRef.current.clear();
      setPendingUpdateCount(pendingUpdatesRef.current.size); // 0になるはず

      // 4. 関連クエリを無効化してサーバーから最新データを取得
      //    これにより、allNotifications と overallUnreadCount がサーバーの最新状態で更新されることを期待
      //    - "notifications" クエリ: 現在のフィルターだけでなく、他のフィルターのビューにも影響が及ぶ可能性があるため、
      //      userId を含むルートレベルで無効化し、関連する通知リストを再フェッチさせる。
      //    - "hasUnreadNotifications" クエリ: 全体の未読件数を直接取得するようなクエリがあれば、それも無効化。
      //      （現在の実装では getNotificationsAndUnreadCount が兼ねているが、分離している場合を想定）
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      // もし全体の未読数専用のクエリキーがあれば、それも無効化 (こちらも async のため await が必要)
      // await queryClient.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
      // console.log("[通知] syncMutation onSuccess: 関連クエリを無効化しました。");
    },
    onError: (error) => {
      console.log("src/hooks/notification/use-notification-list.ts_syncMutation_error");
      console.error("[通知] 同期エラー (ミューテーション):", error);
    },
    onSettled: async () => {
      console.log("src/hooks/notification-list.ts_syncMutation_settled");
      // 未読通知数のキャッシュを無効化 (サーバーからの最新値取得のため)
      await queryClient.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** TanStack Query を使用した通知取得 */
  const {
    data: queryData,
    isLoading: queryIsLoading,
    isFetching: queryIsFetching,
    error: queryError,
    isPlaceholderData, // isPlaceholderData を追加
  } = useQuery<
    { notifications: NotificationData[]; totalCount: number; unreadCount: number; readCount: number },
    Error,
    { notifications: NotificationData[]; totalCount: number; unreadCount: number; readCount: number },
    // クエリキーの型を修正: [string, string | undefined, FilterType, number, number]
    readonly [string, string | undefined, FilterType, number, number]
  >({
    // クエリキーに activeFilter と currentPageByFilter[activeFilter] を含める
    queryKey: ["notifications", userId, activeFilter, currentPageByFilter[activeFilter], NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE],
    queryFn: async (): Promise<{ notifications: NotificationData[]; totalCount: number; unreadCount: number; readCount: number }> => {
      console.log(
        `src/hooks/notification/use-notification-list.ts_useQuery_fetchNotifications_start (filter: ${activeFilter}, page: ${currentPageByFilter[activeFilter]})`,
      );

      if (!userId) {
        console.warn("userId is not available for fetching notifications.");
        return { notifications: [], totalCount: 0, unreadCount: 0, readCount: 0 };
      }

      // getNotificationsAndUnreadCount に activeFilter を渡す
      const result = await getNotificationsAndUnreadCount(
        userId,
        currentPageByFilter[activeFilter],
        NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE,
        activeFilter,
      );
      console.log(
        `[通知] Fetched filter: ${activeFilter}, page: ${currentPageByFilter[activeFilter]}: items received = ${result.notifications.length}, totalCount (for filter) = ${result.totalCount}, overallUnread = ${result.unreadCount}`,
      );

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
      return {
        notifications: processedNotifications,
        totalCount: result.totalCount ?? 0, // このフィルター条件での総件数
        unreadCount: result.unreadCount ?? 0, // 全体の未読件数
        readCount: result.readCount ?? 0, // 全体の既読件数
      };
    },
    staleTime: 1000 * 60 * 30, // 30分
    gcTime: 1000 * 60 * 30,
    placeholderData: (previousData) => previousData, // ページネーション時のちらつきを防ぐ
    enabled: !!userId, // userIdが存在する場合のみクエリを有効化
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useQuery から取得したデータを allNotifications state にマージする
  useEffect(() => {
    if (queryData && !isPlaceholderData) {
      // isPlaceholderDataでない場合のみ更新
      const { notifications: fetchedItems, unreadCount: serverOverallUnreadCount } = queryData;

      // サーバーからの全体の未読数を反映 (これが正となる)
      // ただし、ローカルに未同期の保留中の変更がある場合は、それらが完了して
      // pendingUpdatesRef.current.size が 0 になるまで、
      // overallUnreadCount の値をサーバーからの値で直接上書きしない。
      // これにより、オプティミスティックな更新がサーバーフェッチによって不意に巻き戻されるのを防ぐ。
      // syncNotificationsMutate の onSuccess でクエリを無効化し再フェッチするため、
      // ここで pendingUpdatesRef.current.size === 0 の条件は重要。
      if (pendingUpdatesRef.current.size === 0 && serverOverallUnreadCount !== undefined) {
        setOverallUnreadCount(serverOverallUnreadCount);
      }

      setAllNotifications((prevAllNotifications) => {
        const newNotificationsMap = new Map(prevAllNotifications.map((n) => [n.id, n]));
        fetchedItems.forEach((item) => {
          // 既存の item の sentAt が Date オブジェクトであることを確認し、そうでない場合は変換する
          // 新しくフェッチされた item の sentAt も Date オブジェクトに変換する
          const processedItem = {
            ...item,
            sentAt: item.sentAt ? new Date(item.sentAt) : null, // null も許容
            readAt: item.readAt ? new Date(item.readAt) : null,
            expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
          };
          newNotificationsMap.set(item.id, processedItem); // 新しいアイテムで上書き or 追加
        });

        const updatedNotifications = Array.from(newNotificationsMap.values());

        // 保留中の更新を適用 (同期前でもローカルで即時反映させるため)
        // これにより、フェッチデータとローカル変更がマージされる
        // syncNotificationsMutateのonSuccessでallNotificationsが更新された後、
        // invalidateQueriesにより再フェッチされ、このuseEffectが再度実行される。
        // その際、pendingUpdatesRef.current はクリアされているはずだが、
        // 万が一クリア前にこの処理が走るケースを考慮し、残しておく。
        // ただし、主なオプティミスティック更新は toggleReadStatus や markAllAsRead で行い、
        // syncNotificationsMutate の onSuccess でローカルstateに反映、
        // その後 invalidateQueries & 再フェッチでサーバー状態に収束させるのが理想。
        pendingUpdatesRef.current.forEach((isRead, id) => {
          const index = updatedNotifications.findIndex((n) => n.id === id);
          if (index !== -1) {
            // isRead だけでなく readAt も更新
            updatedNotifications[index] = { ...updatedNotifications[index], isRead, readAt: isRead ? new Date() : null };
          }
        });

        // sentAtでソート
        updatedNotifications.sort((a, b) => {
          if (!a.sentAt && !b.sentAt) return 0;
          if (!a.sentAt) return 1; // sentAt が null のものを後ろに
          if (!b.sentAt) return -1; // sentAt が null のものを後ろに
          return b.sentAt.getTime() - a.sentAt.getTime();
        });

        console.log(`[通知] setAllNotifications updated. Merged ${fetchedItems.length} items. New total count: ${updatedNotifications.length}`);
        return updatedNotifications;
      });
    }
  }, [queryData, isPlaceholderData]); // 依存配列から notifications.length を削除、allNotifications は直接更新しない

  // hasMore のロジックを queryData.totalCount と allNotifications (フィルタリング後) に基づいて更新
  useEffect(() => {
    if (queryData && userId) {
      const currentFilterTotalCount = queryData.totalCount; // 現在のactiveFilterでのサーバー上の総数

      // allNotifications から現在の activeFilter に合致するアイテム数をカウント
      const loadedItemsCountForCurrentFilter = allNotifications.filter((n) => {
        if (activeFilter === "unread") return !n.isRead;
        if (activeFilter === "read") return n.isRead;
        return true; // "all"
      }).length;

      const newHasMore = loadedItemsCountForCurrentFilter < currentFilterTotalCount;
      if (hasMore !== newHasMore) {
        setHasMore(newHasMore);
        console.log(
          `[通知] hasMore for filter ${activeFilter} updated. Value: ${newHasMore} (total for filter: ${currentFilterTotalCount}, current loaded matching filter: ${loadedItemsCountForCurrentFilter})`,
        );
      }
    } else if (!userId) {
      setHasMore(false); // ユーザーIDがない場合は追加読み込みなし
    }
    // queryData が undefined の場合 (初期ロード前など) は hasMore を変更しないか、true にしておく
    // currentPageByFilter[activeFilter] も考慮に入れるとより正確になる場合がある
  }, [allNotifications, queryData, activeFilter, hasMore, userId, currentPageByFilter]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 既読/未読状態の切り替え
  const toggleReadStatus = useCallback(
    (id: string, isRead: boolean) => {
      console.log(`[通知] 状態変更: ID=${id}, 既読=${isRead}`);

      const currentNotification = allNotifications.find((n) => n.id === id);

      // 既存の通知で、かつ状態が変わらない場合は何もしない
      if (currentNotification && currentNotification.isRead === isRead) {
        return;
      }

      // 保留中の更新に追加 (Refを直接更新)
      const newPendingUpdates = new Map(pendingUpdatesRef.current);
      newPendingUpdates.set(id, isRead);
      pendingUpdatesRef.current = newPendingUpdates;
      setPendingUpdateCount(newPendingUpdates.size); // 保留中の更新数を更新

      // allNotifications state を即時更新
      setAllNotifications((prevNotifications) =>
        prevNotifications.map((n) => (n.id === id ? { ...n, isRead, readAt: isRead ? new Date() : null } : n)),
      );

      // overallUnreadCount を即時更新
      if (currentNotification) {
        // currentNotification が null でないことを確認
        setOverallUnreadCount((prevCount) => prevCount + (isRead ? -1 : 1));
      }
    },
    [allNotifications], // allNotifications を依存配列に追加
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // すべての通知を既読にする
  const markAllAsRead = useCallback(() => {
    console.log("[通知] すべて既読にする");

    let changed = false;
    const updatedIds: string[] = [];
    let unreadNotificationsMarkedAsRead = 0;

    setAllNotifications((prevNotifications) => {
      const newNotifications = prevNotifications.map((notification) => {
        if (!notification.isRead) {
          changed = true;
          updatedIds.push(notification.id);
          unreadNotificationsMarkedAsRead++;
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
      // overallUnreadCount を即時更新
      setOverallUnreadCount((prevCount) => Math.max(0, prevCount - unreadNotificationsMarkedAsRead));
    } else {
      console.log("[通知] 未読通知がないためスキップ");
    }
  }, []); // setAllNotifications, setOverallUnreadCount は安定しているので依存配列は空でOK

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター変更ハンドラー
  const handleFilterChange = useCallback((filter: FilterType) => {
    console.log(`[通知] フィルター変更: ${filter}`);
    setActiveFilter(filter);
    // フィルター変更時は、関連するフィルターのページネーションをリセットする
    // 全てのフィルターのページを1に戻すことで、新しいフィルター条件で最初から表示する
    setCurrentPageByFilter((prev) => ({
      ...prev, // 他のフィルター設定（例：オークションフィルターなど）は維持
      all: 1,
      unread: 1,
      read: 1,
      [filter]: 1, // 現在アクティブになったフィルターのページを1に設定 (冗長だが明確化のため)
    }));
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションフィルター変更ハンドラー
  const handleAuctionFilterChange = useCallback((filter: AuctionFilterType) => {
    console.log(`[通知] オークションフィルター変更: ${filter}`);
    setActiveAuctionFilter(filter);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 手動更新ハンドラー
  const handleManualRefresh = useCallback(() => {
    // 手動更新の非同期処理
    const refreshAsync = async () => {
      console.log("src/hooks/notification/use-notification-list.ts_handleManualRefresh_start");

      if (pendingUpdatesRef.current.size > 0) {
        await syncNotificationsMutateAsync(new Map(pendingUpdatesRef.current)); // 現在の保留内容を渡す
      }
      console.log("[通知] 手動更新によるキャッシュ無効化と再フェッチ");
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId, activeFilter] }); // 現在のフィルター
      await queryClient.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] }); // 全体の未読数
    };
    void refreshAsync();
  }, [syncNotificationsMutateAsync, queryClient, userId, activeFilter]); // syncMutation を依存配列に追加

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // パス変更を検知して保留中の更新を同期
  useEffect(() => {
    console.log(`[通知] パス変更検知: ${pathname}`);
    console.log("src/hooks/notification/use-notification-list.ts_useEffect_pathname_change_start");

    if (pendingUpdatesRef.current.size > 0 && userId) {
      // userIdチェック追加
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_pathname_change_sync_start");
      syncNotificationsMutate(new Map(pendingUpdatesRef.current)); // 非同期で実行、現在の保留内容を渡す
    }
  }, [pathname, syncNotificationsMutate, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** ブラウザタブの表示状態変更を検知して保留中の更新を同期 */
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_visibilitychange_start");
      if (document.visibilityState === "hidden" && pendingUpdatesRef.current.size > 0 && userId) {
        console.log("[通知] タブ非表示検知、保留中の更新を同期");
        // handleManualRefresh を直接呼ぶ代わりに syncNotificationsMutate を呼ぶ方がシンプル
        syncNotificationsMutate(new Map(pendingUpdatesRef.current));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    console.log("[通知] visibilitychange リスナー登録");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pendingUpdatesRef.current.size > 0 && userId) {
        console.log("[通知] アンマウント前の最終同期 (visibilitychange cleanup)");
        syncNotificationsMutate(new Map(pendingUpdatesRef.current));
      }
      console.log("src/hooks/notification/use-notification-list.ts_useEffect_visibilitychange_end");
    };
  }, [syncNotificationsMutate, userId]); // syncMutation, userId を依存配列に追加

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** 追加の通知を読み込む関数 */
  const loadMoreNotifications = useCallback(() => {
    // 追加読み込み可能かつ、フェッチ中でない場合、かつプレースホルダーデータでない場合
    if (hasMore && !queryIsFetching && !isPlaceholderData) {
      console.log(`[通知] 追加読み込み実行 for filter ${activeFilter}, current page: ${currentPageByFilter[activeFilter]}`);
      setCurrentPageByFilter((prev) => ({ ...prev, [activeFilter]: prev[activeFilter] + 1 }));
    } else {
      console.log(`[通知] 追加読み込みスキップ: hasMore=${hasMore}, queryIsFetching=${queryIsFetching}, isPlaceholderData=${isPlaceholderData}`);
    }
  }, [hasMore, queryIsFetching, activeFilter, isPlaceholderData, currentPageByFilter, setCurrentPageByFilter]); // currentPageByFilter を依存配列に追加

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // isLoading の判定: 現在のフィルターで表示されるべきアイテムが allNotifications にまだなく、かつクエリがロード中の場合
  const isLoadingState =
    queryIsLoading && currentPageByFilter[activeFilter] === 1 && !isPlaceholderData && filteredNotificationsForDisplay().length === 0;

  return {
    // state
    notifications: filteredNotificationsForDisplay(), // 表示用はオークションフィルターも適用
    isLoading: isLoadingState,
    isLoadingMore: queryIsFetching && (currentPageByFilter[activeFilter] > 1 || (isPlaceholderData && currentPageByFilter[activeFilter] > 0)), // プレースホルダー表示中もisLoadingMoreはtrueになりうる
    error: queryError
      ? queryError instanceof Error
        ? `通知の取得に失敗しました: ${queryError.message}`
        : "通知の取得中にエラーが発生しました"
      : null,
    unreadCount: overallUnreadCount, // unreadCount は全体の未読数を返す
    hasMore, // 現在のフィルターでのhasMore
    activeFilter,
    activeAuctionFilter,
    pendingUpdateCount,

    // 関数
    toggleReadStatus,
    markAllAsRead,
    handleFilterChange,
    handleAuctionFilterChange,
    handleManualRefresh,
    loadMoreNotifications,
  };
}
