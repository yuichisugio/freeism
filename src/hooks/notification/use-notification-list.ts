"use client";

import type { AuctionEventType, NotificationTargetType } from "@prisma/client";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getNotificationsAndUnreadCount, updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";
import { NOTIFICATION_CONSTANTS } from "@/lib/auction/constants";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  hasMore: boolean | undefined;
  activeFilter: FilterType;
  activeAuctionFilter: AuctionFilterType;
  markAllAsRead: () => void;
  handleFilterChange: (filter: FilterType) => void;
  handleAuctionFilterChange: (filter: AuctionFilterType) => void;
  handleManualRefresh: () => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/** `queryFn` が返す各ページのデータ型 */
type QueryFnReturnType = {
  notifications: NotificationData[];
  totalCount: number;
  unreadCount: number; // このページ取得時の全体の未読数
  readCount: number; // このページ取得時の全体の既読数
};

/** `select` 関数が返すデータの型であり、`useInfiniteQuery` フックの `data` の型となる */
type SelectedResultType = {
  flatNotifications: NotificationData[];
  overallUnreadCount: number;
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

  // フィルター情報 (ページネーションは useInfiniteQuery が管理)
  const [activeFilter, setActiveFilter] = useState<FilterType>("unread");
  const [activeAuctionFilter, setActiveAuctionFilter] = useState<AuctionFilterType>("all");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // クエリクライアント
  const queryClient = useQueryClient();

  // セッション
  const session = useSession();
  const userId = session.data?.user?.id;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const {
    data,
    isLoading,
    isFetchingNextPage,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery<
    QueryFnReturnType,
    Error,
    SelectedResultType,
    readonly [string, string | undefined, { filter: FilterType; auction: AuctionFilterType }],
    number
  >({
    queryKey: ["notifications", userId, { filter: activeFilter, auction: activeAuctionFilter }],
    queryFn: async ({ pageParam }) => {
      console.log(
        `src/hooks/notification/use-notification-list.ts_useInfiniteQuery_queryFn (filter: ${activeFilter}, auction: ${activeAuctionFilter}, page: ${pageParam})`,
      );
      if (!userId) {
        console.warn("userId is not available for fetching notifications.");
        return { notifications: [], totalCount: 0, unreadCount: 0, readCount: 0 };
      }
      const result = await getNotificationsAndUnreadCount(userId, pageParam, NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE, activeFilter);
      console.log(
        `[通知] Fetched filter: ${activeFilter}, page: ${pageParam}: items received = ${result.notifications.length}, totalCount (for filter) = ${result.totalCount}, overallUnread = ${result.unreadCount}`,
      );
      const processedNotifications: NotificationData[] = result.notifications.map((notification) => ({
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
        totalCount: result.totalCount ?? 0,
        unreadCount: result.unreadCount ?? 0,
        readCount: result.readCount ?? 0,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const loadedCount = _allPages.reduce((acc, page) => acc + page.notifications.length, 0);
      if (loadedCount < lastPage.totalCount) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    select: (fetchedData: InfiniteData<QueryFnReturnType, number>): SelectedResultType => {
      let allFetchedNotifications = fetchedData.pages.flatMap((p) => p.notifications);

      if (activeAuctionFilter === "auction-only") {
        allFetchedNotifications = allFetchedNotifications.filter((n) => n.auctionEventType !== null);
      } else if (activeAuctionFilter === "exclude-auction") {
        allFetchedNotifications = allFetchedNotifications.filter((n) => n.auctionEventType === null);
      }

      allFetchedNotifications.sort((a, b) => {
        if (!a.sentAt && !b.sentAt) return 0;
        if (!a.sentAt) return 1;
        if (!b.sentAt) return -1;
        return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
      });

      return {
        pages: fetchedData.pages,
        pageParams: fetchedData.pageParams,
        flatNotifications: allFetchedNotifications,
        overallUnreadCount: fetchedData.pages[0]?.unreadCount ?? 0,
      };
    },
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30,
    enabled: !!userId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** すべて既読にする */
  const { mutate: markAllAsReadMutate } = useMutation({
    mutationFn: async (notificationIdsToMarkRead: string[]) => {
      if (!userId || notificationIdsToMarkRead.length === 0) return;
      const updates = notificationIdsToMarkRead.map((id) => ({ notificationId: id, isRead: true }));
      await updateNotificationStatus(updates);
    },
    onMutate: async (notificationIdsToMarkRead: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      const previousNotificationsData = queryClient.getQueriesData<InfiniteData<QueryFnReturnType, number>>({
        queryKey: ["notifications", userId],
      });

      queryClient.setQueriesData<InfiniteData<QueryFnReturnType, number>>({ queryKey: ["notifications", userId], exact: false }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((pageGroup) => ({
            ...pageGroup,
            notifications: pageGroup.notifications.map((n) =>
              notificationIdsToMarkRead.includes(n.id) && !n.isRead ? { ...n, isRead: true, readAt: new Date() } : n,
            ),
            unreadCount: 0,
          })),
        };
      });
      return { previousNotificationsData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotificationsData) {
        context.previousNotificationsData.forEach(([key, queryData]) => {
          if (queryData !== undefined) {
            queryClient.setQueryData(key, queryData);
          }
        });
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      await queryClient.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /** すべて既読にする */
  const markAllAsRead = useCallback(() => {
    console.log("[通知] すべて既読にする");
    const unreadNotificationIds = data?.flatNotifications?.filter((n) => !n.isRead).map((n) => n.id) ?? [];
    if (unreadNotificationIds.length > 0) {
      markAllAsReadMutate(unreadNotificationIds);
    } else {
      console.log("[通知] 未読通知がないためスキップ");
    }
  }, [data?.flatNotifications, markAllAsReadMutate]);

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
    notifications: data?.flatNotifications ?? [],
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error: queryError
      ? queryError instanceof Error
        ? `通知の取得に失敗しました: ${queryError.message}`
        : "通知の取得中にエラーが発生しました"
      : null,
    unreadCount: data?.overallUnreadCount ?? 0,
    hasMore: hasNextPage,
    activeFilter,
    activeAuctionFilter,
    markAllAsRead,
    handleFilterChange,
    handleAuctionFilterChange,
    handleManualRefresh,
    loadMoreNotifications,
  };
}
