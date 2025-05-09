"use client";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { getNotificationsAndUnreadCount, updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/auction/constants";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
  readHasMore: boolean;
  unReadHasMore: boolean;
  activeFilter: FilterType;
  activeAuctionFilter: AuctionFilterType;
  markAllAsRead: () => void;
  handleFilterChange: (filter: FilterType) => void;
  handleAuctionFilterChange: (filter: AuctionFilterType) => void;
  handleManualRefresh: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  handleToggleRead: (id: string, isRead: boolean) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** `queryFn` が返す各ページのデータ型 */
type QueryFnReturnType = {
  notifications: NotificationData[];
  totalCount: number;
  unreadCount: number; // このページ取得時の全体の未読数
  readCount: number; // このページ取得時の全体の既読数
};

// ーーーーーーーーーーーー

/** 既存の useInfiniteQuery から返されるデータの型構造に合わせる */
type InfiniteQueryData = {
  pages: {
    notifications: NotificationData[];
    totalCount: number;
    unreadCount: number;
    readCount: number;
  }[];
  pageParams: number[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーー

/** `select` 関数が返すデータの型であり、`useInfiniteQuery` フックの `data` の型となる */
type SelectedResultType = {
  flatNotifications: NotificationData[];
  overallUnreadCount: number;
  readHasMore: boolean;
  unReadHasMore: boolean;
  pages: QueryFnReturnType[];
  pageParams: number[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知管理カスタムフック
 * @returns {NotificationManagerResult} 通知管理カスタムフックの返り値
 */
export function useNotificationList(): NotificationManagerResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルター情報
  const [activeFilter, setActiveFilter] = useState<FilterType>("unread");
  // オークションフィルター情報
  const [activeAuctionFilter, setActiveAuctionFilter] = useState<AuctionFilterType>("all");

  // 通知リスト
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  // フィルターに応じた通知リスト
  const [filteredNotifications, setFilteredNotifications] = useState<NotificationData[]>([]);
  // 未読数
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** pending: <通知ID, 最終的な isRead 値> を保持する Map */
  const pending = useRef<Map<string, boolean>>(new Map());

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // クエリクライアント
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // セッション
  const session = useSession();
  const userId = session.data?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const {
    data,
    isLoading,
    isFetchingNextPage,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery<QueryFnReturnType, Error, SelectedResultType, readonly [string, string | undefined], number>({
    queryKey: ["notifications", userId],
    queryFn: async ({ pageParam }) => {
      console.log(`src/hooks/notification/use-notification-list.ts_useInfiniteQuery_queryFn (page: ${pageParam})`);
      if (!userId) {
        console.warn("userId is not available for fetching notifications.");
        return { notifications: [], totalCount: 0, unreadCount: 0, readCount: 0 };
      }
      const result = await getNotificationsAndUnreadCount(userId, pageParam, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE);

      const uniqueNotifications = Array.from(new Map(result.notifications.map((n) => [n.id, n])).values());

      console.log(`[通知] Fetched page: ${pageParam}: items received = ${uniqueNotifications.length}`);
      const processedNotifications: NotificationData[] = uniqueNotifications.map((notification) => ({
        ...notification,
        isRead: notification.isRead,
        sentAt: notification.sentAt ? new Date(notification.sentAt) : null,
        readAt: notification.readAt ? new Date(notification.readAt) : null,
        expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : null,
        userName: notification.userName ?? null,
        groupName: notification.groupName ?? null,
        taskName: notification.taskName ?? null,
        senderUserId: notification.senderUserId ?? null,
        auctionEventType: notification.auctionEventType as AuctionEventType | null,
        auctionId: notification.auctionId ?? null,
      }));
      return {
        notifications: processedNotifications,
        totalCount: result.totalCount,
        unreadCount: result.unreadCount,
        readCount: result.readCount,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      // allPages には今までのページデータ (QueryFnReturnType[]) が格納されている
      // lastPage には最新のページデータ (QueryFnReturnType) が格納されている
      // lastPage.readCount はAPIから返された全体の既読通知の総数
      // lastPage.unreadCount はAPIから返された全体の未読通知の総数

      // これまでに読み込まれた既読・未読の通知数を計算
      let loadedReadCount = 0;
      let loadedUnreadCount = 0;
      allPages.forEach((page) => {
        page.notifications.forEach((notification) => {
          if (notification.isRead) {
            loadedReadCount++;
          } else {
            loadedUnreadCount++;
          }
        });
      });

      const hasMoreRead = loadedReadCount < lastPage.readCount;
      const hasMoreUnread = loadedUnreadCount < lastPage.unreadCount;

      if (hasMoreRead || hasMoreUnread) {
        return lastPageParam + 1;
      }
      return undefined; // これ以上読み込むページがない場合は undefined を返す
    },
    select: (fetchedData: InfiniteData<QueryFnReturnType, number>): SelectedResultType => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 取得したデータをフラット化
      const allFetchedNotifications = fetchedData.pages.flatMap((p) => p.notifications);

      //
      const uniqueNotificationsMap = new Map<string, NotificationData>();

      allFetchedNotifications.forEach((notification) => {
        uniqueNotificationsMap.set(notification.id, notification);
      });

      const finalUniqueNotifications = Array.from(uniqueNotificationsMap.values());

      finalUniqueNotifications.sort((a, b) => {
        if (!a.sentAt && !b.sentAt) return 0;
        if (!a.sentAt) return 1; // null or undefined sentAt should come after
        if (!b.sentAt) return -1; // null or undefined sentAt should come after
        return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
      });

      const currentOverallUnreadCount = finalUniqueNotifications.filter((n) => !n.isRead).length;

      // readHasMore と unReadHasMore の計算
      let currentLoadedReadCount = 0;
      let currentLoadedUnreadCount = 0;
      finalUniqueNotifications.forEach((notification) => {
        if (notification.isRead) {
          currentLoadedReadCount++;
        } else if (!notification.isRead) {
          currentLoadedUnreadCount++;
        }
      });

      // 最新の総数は、最後のページデータから取得
      const lastPageData = fetchedData.pages[fetchedData.pages.length - 1];
      let readHasMore = false;
      let unReadHasMore = false;

      // 読み込まれた通知数が総数と一致したら、hasMoreをfalseにする。
      // useInfiniteQueryは前回取得した値が入る。
      // 全件取得後はuseInfiniteQuery実行後も未読/既読のそれぞれの件数の内容は変わらないが、setQueryDataでキャッシュを更新しているため、通知全権取得後は数がズレる。なので全件取得後はtotalCountと読み込まれた数が一致するかでhasMoreを判断する。
      if (lastPageData.totalCount == currentLoadedReadCount + currentLoadedUnreadCount) {
        readHasMore = false;
        unReadHasMore = false;
        // 総数と一致しない場合は、読み込みを継続
      } else {
        readHasMore = currentLoadedReadCount < lastPageData.readCount;
        unReadHasMore = currentLoadedUnreadCount < lastPageData.unreadCount;
      }

      console.log(
        `[通知] useInfiniteQuery_select: currentLoadedReadCount: ${currentLoadedReadCount}, totalReadFromServer: ${lastPageData.readCount}`,
      );
      console.log(
        `[通知] useInfiniteQuery_select: currentLoadedUnreadCount: ${currentLoadedUnreadCount}, totalUnreadFromServer: ${lastPageData.unreadCount}`,
      );
      console.log(`[通知] useInfiniteQuery_select: readHasMore: ${readHasMore}, unReadHasMore: ${unReadHasMore}`);

      return {
        pages: fetchedData.pages.map((page) => ({
          ...page,
          notifications: page.notifications,
        })),
        pageParams: fetchedData.pageParams,
        flatNotifications: finalUniqueNotifications,
        overallUnreadCount: currentOverallUnreadCount, // 現在クライアントにロードされている通知の中での未読数
        readHasMore,
        unReadHasMore,
      };
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 30,
    enabled: !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // データが取得されたら通知リストと未読数を更新
  useEffect(() => {
    if (data) {
      setNotifications(data.flatNotifications);
      setUnreadCount(data.overallUnreadCount);
    }
  }, [data]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // フィルターが変更されたら通知リストを更新
  useEffect(() => {
    let intermediateNotifications = notifications;

    if (activeAuctionFilter === "auction-only") {
      intermediateNotifications = intermediateNotifications.filter((n) => n.auctionEventType !== null);
    } else if (activeAuctionFilter === "exclude-auction") {
      intermediateNotifications = intermediateNotifications.filter((n) => n.auctionEventType === null);
    }

    if (activeFilter === "unread") {
      setFilteredNotifications(intermediateNotifications.filter((n) => !n.isRead));
    } else if (activeFilter === "read") {
      setFilteredNotifications(intermediateNotifications.filter((n) => n.isRead));
    } else if (activeFilter === "all") {
      setFilteredNotifications(intermediateNotifications);
    }
  }, [notifications, activeFilter, activeAuctionFilter]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // unreadCount が変更されたら hasUnreadNotifications クエリを更新
  useEffect(() => {
    if (userId) {
      queryClient.setQueryData(["hasUnreadNotifications", userId], unreadCount > 0);
    }
  }, [unreadCount, userId, queryClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** 既読/未読を切り替える */
  const toggleRead = useCallback(
    (updatedNotificationId: string, newIsReadStatus: boolean) => {
      // ローカルステートを即時更新
      setNotifications((prevNotifications) =>
        prevNotifications.map((prevNotification) =>
          prevNotification.id === updatedNotificationId
            ? { ...prevNotification, isRead: newIsReadStatus, readAt: newIsReadStatus ? new Date() : null }
            : prevNotification,
        ),
      );
      setUnreadCount(unreadCount - (newIsReadStatus ? 1 : -1));

      // 保留リストを更新
      pending.current.set(updatedNotificationId, newIsReadStatus);
    },
    [unreadCount],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アンマウント時：pending をまとめてフラッシュ
   * - DB 更新 → キャッシュ再検証
   */
  useEffect(() => {
    const pendingRefAtEffectSetup = pending.current;
    return () => {
      if (!userId || pendingRefAtEffectSetup.size === 0) {
        return;
      }

      const updatesToSync = Array.from(pendingRefAtEffectSetup.entries()).map(([notificationId, isRead]) => ({
        notificationId,
        isRead,
      }));

      if (updatesToSync.length === 0) return;

      updateNotificationStatus(updatesToSync)
        .then(() => {
          console.log("[通知] アンマウント時のバッチ更新成功、キャッシュを直接更新します。", updatesToSync);
          queryClient.setQueriesData<InfiniteQueryData>({ queryKey: ["notifications", userId] }, (oldData) => {
            if (!oldData) return oldData;

            // updatesToSync を Map 形式に変換して効率的に参照できるようにする
            const updatesMap = new Map(updatesToSync.map((u) => [u.notificationId, u.isRead]));

            const newPages = oldData.pages.map((page) => {
              const newNotifications = page.notifications.map((n) => {
                // pending.current ではなく、同期的に作成した updatesMap を使用して更新を判定
                if (updatesMap.has(n.id)) {
                  const newIsRead = updatesMap.get(n.id)!;
                  return { ...n, isRead: newIsRead, readAt: newIsRead ? new Date() : null };
                }
                return n;
              });
              return { ...page, notifications: newNotifications };
            });

            // 更新されたキャッシュ内の全通知から最新の未読総数を再計算
            const allFinalNotifications = newPages.flatMap((p) => p.notifications);
            const finalOverallUnreadCount = allFinalNotifications.filter((n) => !n.isRead).length;

            // グローバルな未読件数ステートを更新
            setUnreadCount(finalOverallUnreadCount);
            // hasUnreadNotifications クエリも更新
            queryClient.setQueryData(["hasUnreadNotifications", userId], finalOverallUnreadCount > 0);

            return { ...oldData, pages: newPages };
          });
        })
        .catch((err) => {
          console.error("[通知] アンマウント時のバッチ更新に失敗しました。", err);
        });
    };
  }, [userId, queryClient]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** すべて既読にする */
  const markAllAsRead = useCallback(() => {
    console.log("[通知] すべて既読にする");
    if (!userId) return;

    setNotifications((prevNotifications) =>
      prevNotifications.map((n) => {
        if (!n.isRead) {
          pending.current.set(n.id, true);
          return { ...n, isRead: true, readAt: new Date() };
        }
        return n;
      }),
    );
    setUnreadCount(0);
    queryClient.setQueryData(["hasUnreadNotifications", userId], false);
  }, [queryClient, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** フィルター変更 */
  const handleFilterChange = useCallback((filter: FilterType) => {
    console.log(`[通知] フィルター変更: ${filter}`);
    setActiveFilter(filter);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** オークションフィルター変更 */
  const handleAuctionFilterChange = useCallback((filter: AuctionFilterType) => {
    console.log(`[通知] オークションフィルター変更: ${filter}`);
    setActiveAuctionFilter(filter);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** 手動更新 */
  const handleManualRefresh = useCallback(async (): Promise<void> => {
    console.log("[通知] 手動更新");
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
  }, [refetch, queryClient, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** 追加読み込み */
  const loadMoreNotifications = useCallback(async (): Promise<void> => {
    if (hasNextPage && !isFetchingNextPage) {
      console.log(`[通知] 追加読み込み実行 for filter ${activeFilter}, auction ${activeAuctionFilter}`);
      await fetchNextPage();
    } else {
      console.log(`[通知] 追加読み込みスキップ: hasNextPage=${hasNextPage}, isFetchingNextPage=${isFetchingNextPage}`);
    }
  }, [hasNextPage, isFetchingNextPage, activeFilter, activeAuctionFilter, fetchNextPage]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    notifications: filteredNotifications,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error: queryError
      ? queryError instanceof Error
        ? `通知の取得に失敗しました: ${queryError.message}`
        : "通知の取得中にエラーが発生しました"
      : null,
    unreadCount: unreadCount,
    readHasMore: data?.readHasMore ?? false,
    unReadHasMore: data?.unReadHasMore ?? false,
    activeFilter,
    activeAuctionFilter,
    markAllAsRead,
    handleFilterChange,
    handleAuctionFilterChange,
    handleManualRefresh,
    loadMoreNotifications,
    handleToggleRead: toggleRead,
  };
}
