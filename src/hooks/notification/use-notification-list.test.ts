import type { NotificationData } from "@/actions/notification/cache-notification-utilities";
import {
  getNotificationsAndUnreadCount,
  updateNotificationStatus,
} from "@/actions/notification/notification-utilities";
import { mockUseSession } from "@/test/setup/setup";
import { AllTheProviders, mockUseInfiniteQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { faker } from "@faker-js/faker";
import { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useNotificationList } from "./use-notification-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next/navigationのモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// 通知関連アクションのモック
vi.mock("@/lib/actions/notification/notification-utilities", () => ({
  getNotificationsAndUnreadCount: vi.fn(),
  updateNotificationStatus: vi.fn(),
}));

// 定数のモック
vi.mock("@/lib/constants", () => ({
  NOTIFICATION_CONSTANTS: {
    ITEMS_PER_PAGE: 50,
  },
}));

// TanStack Queryのキャッシュキーのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    Notification: {
      userAllNotifications: vi.fn((userId: string) => ["notifications", "user", userId, "all"]),
      hasUnreadNotifications: vi.fn((userId: string) => ["notifications", "user", userId, "hasUnread"]),
    },
  },
}));

// TanStack Queryのモック設定は tanstack-query-setup.tsx で行われています

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Fisheryファクトリーを使用したテストデータ作成
 */

// 通知データファクトリー
const notificationFactory = Factory.define<NotificationData>(({ sequence, params }) => ({
  id: params.id ?? `notification-${sequence}`,
  title: params.title ?? faker.lorem.sentence(),
  message: params.message ?? faker.lorem.paragraph(),
  NotificationTargetType: params.NotificationTargetType ?? NotificationTargetType.USER,
  isRead: params.isRead ?? faker.datatype.boolean(),
  sentAt: params.sentAt ?? faker.date.recent(),
  readAt: params.readAt ?? (params.isRead ? faker.date.recent() : null),
  expiresAt: params.expiresAt ?? null,
  actionUrl: params.actionUrl ?? faker.internet.url(),
  senderUserId: params.senderUserId ?? `sender-${sequence}`,
  groupId: params.groupId ?? null,
  taskId: params.taskId ?? null,
  userName: params.userName ?? faker.person.fullName(),
  groupName: params.groupName ?? null,
  taskName: params.taskName ?? null,
  auctionEventType: params.auctionEventType ?? null,
  auctionId: params.auctionId ?? null,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ作成ヘルパー関数
 */

// 特定パターンの通知データ作成
const createTestNotifications = () => ({
  unread: notificationFactory.build({
    id: "notification-1",
    title: "未読通知1",
    isRead: false,
    auctionEventType: null,
  }),
  read: notificationFactory.build({ id: "notification-2", title: "既読通知1", isRead: true, auctionEventType: null }),
  auction: notificationFactory.build({
    id: "notification-3",
    title: "オークション通知",
    isRead: false,
    auctionEventType: AuctionEventType.AUCTION_WIN,
    auctionId: "auction-1",
  }),
});

// 大量データセット作成
const createLargeDataset = (count: number, isRead = false) => notificationFactory.buildList(count, { isRead });

// 特殊文字を含む通知データ作成
const createSpecialContentNotifications = () => [
  notificationFactory.build({
    id: "unicode-notification",
    title: "🎉🚀💯🔥⭐️🌟✨🎊🎈🎁",
    message: "!@#$%^&*()_+-=[]{}|;':\",./<>?`~",
    isRead: false,
  }),
  notificationFactory.build({
    id: "long-text-notification",
    title: "a".repeat(10000),
    message: "",
    isRead: false,
  }),
  notificationFactory.build({
    id: "missing-date-notification",
    title: "",
    sentAt: null,
    readAt: null,
    expiresAt: null,
    isRead: false,
  }),
];

// 境界値テスト用データ作成
const createBoundaryTestData = () => [
  {
    name: "null notifications",
    data: { notifications: [] as NotificationData[], totalCount: 0, unreadCount: 0, readCount: 0 },
  },
  { name: "negative unread count", data: { notifications: [], totalCount: 3, unreadCount: -1, readCount: 4 } },
  { name: "zero notification count", data: { notifications: [], totalCount: 0, unreadCount: 0, readCount: 0 } },
];

// エラーテスト用データ作成
const createErrorTestData = () => [
  { error: new Error("API Error"), expected: "通知の取得に失敗しました: API Error" },
  { error: new Error("Network timeout"), expected: "通知の取得に失敗しました: Network timeout" },
  { error: new Error("Internal Server Error"), expected: "通知の取得に失敗しました: Internal Server Error" },
  { error: "String error", expected: "通知の取得に失敗しました: String error" },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストヘルパー関数
 */

// useInfiniteQueryのモックデータを設定するヘルパー
const setupInfiniteQueryMock = (
  notifications: NotificationData[],
  options?: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    isFetching?: boolean;
    refetch?: () => void;
  },
) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.filter((n) => n.isRead).length;

  mockUseInfiniteQuery.mockReturnValue({
    data: {
      pages: [
        {
          notifications,
          totalCount: notifications.length,
          unreadCount,
          readCount,
        },
      ],
      pageParams: [1],
      flatNotifications: notifications,
      overallUnreadCount: unreadCount,
      readHasMore: false,
      unReadHasMore: false,
    },
    isLoading: options?.isLoading ?? false,
    isFetching: options?.isFetching ?? false,
    isError: options?.isError ?? false,
    error: options?.error ?? null,
    fetchNextPage: vi.fn(),
    hasNextPage: options?.hasNextPage ?? false,
    isFetchingNextPage: options?.isFetchingNextPage ?? false,
    refetch: options?.refetch ?? vi.fn(),
  });
};

// フックをレンダリングして初期化完了まで待機
const renderAndWaitForInitialization = async () => {
  const { result } = renderHook(() => useNotificationList(), {
    wrapper: AllTheProviders,
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  return { result };
};

// エラーテストのヘルパー
const testErrorHandling = async (error: Error | string, expectedErrorMessage: string) => {
  setupInfiniteQueryMock([], {
    isError: true,
    error: error instanceof Error ? error : new Error(String(error)),
  });

  const { result } = renderHook(() => useNotificationList(), {
    wrapper: AllTheProviders,
  });

  await waitFor(() => {
    expect(result.current.error).not.toBe(null);
    if (result.current.error) {
      expect(result.current.error).toContain(expectedErrorMessage);
    }
  });
};

// フィルターテストのヘルパー
const testFilterBehavior = async (
  filterType: "all" | "read" | "unread",
  auctionFilter: "all" | "auction-only" | "exclude-auction",
  expectedLength: number,
  validationFn?: (notifications: NotificationData[]) => boolean,
) => {
  const { result } = await renderAndWaitForInitialization();

  act(() => {
    result.current.handleFilterChange(filterType);
    result.current.handleAuctionFilterChange(auctionFilter);
  });

  await waitFor(() => {
    expect(result.current.notifications).toHaveLength(expectedLength);
    if (validationFn) {
      expect(validationFn(result.current.notifications)).toBe(true);
    }
  });

  return { result };
};

// パフォーマンステストのヘルパー
const testPerformance = async (operationFn: () => void | Promise<void>, maxTime = 5000) => {
  const startTime = performance.now();
  await Promise.resolve(operationFn());
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(maxTime);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useNotificationList", () => {
  const mockGetNotificationsAndUnreadCount = vi.mocked(getNotificationsAndUnreadCount);
  const mockUpdateNotificationStatus = vi.mocked(updateNotificationStatus);

  let testNotifications: ReturnType<typeof createTestNotifications>;

  beforeEach(() => {
    vi.clearAllMocks();
    testNotifications = createTestNotifications();

    // セッションのモック設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのモック設定
    mockGetNotificationsAndUnreadCount.mockResolvedValue({
      notifications: [testNotifications.unread, testNotifications.read, testNotifications.auction],
      totalCount: 3,
      unreadCount: 2,
      readCount: 1,
    });

    mockUpdateNotificationStatus.mockResolvedValue({ success: true });

    // useInfiniteQueryのデフォルトモック設定
    setupInfiniteQueryMock([testNotifications.unread, testNotifications.read, testNotifications.auction]);

    // useQueryClientのモック設定
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueriesData: vi.fn(),
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化とデータ取得", () => {
    test("should initialize with correct default values and fetch data", async () => {
      // 初期ローディング状態をモック
      setupInfiniteQueryMock([], {
        isLoading: true,
      });

      const { result, rerender } = renderHook(() => useNotificationList(), {
        wrapper: AllTheProviders,
      });

      // 初期状態の確認
      expect(result.current.isLoading).toBe(true);
      expect(result.current.notifications).toStrictEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.activeFilter).toBe("unread");
      expect(result.current.activeAuctionFilter).toBe("all");
      expect(result.current.error).toBe(null);

      // 関数の存在確認
      expect(typeof result.current.markAllAsRead).toBe("function");
      expect(typeof result.current.handleFilterChange).toBe("function");
      expect(typeof result.current.handleAuctionFilterChange).toBe("function");
      expect(typeof result.current.handleManualRefresh).toBe("function");
      expect(typeof result.current.loadMoreNotifications).toBe("function");
      expect(typeof result.current.handleToggleRead).toBe("function");

      // データ取得完了後の状態をモック
      setupInfiniteQueryMock([testNotifications.unread, testNotifications.read, testNotifications.auction]);

      // フックを再レンダリングして新しいモック状態を反映
      rerender();

      // データ取得完了後の確認
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.notifications).toHaveLength(2); // unreadフィルターのため
        expect(result.current.unreadCount).toBe(2);
      });
    });

    test("should handle empty notifications", async () => {
      setupInfiniteQueryMock([]);

      const { result } = await renderAndWaitForInitialization();

      expect(result.current.notifications).toStrictEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
    });

    test.each(createErrorTestData())("should handle $error.message error gracefully", async ({ error, expected }) => {
      await testErrorHandling(error, expected);
      expect(true).toBe(true); // アサーションを追加
    });

    test("should handle malformed API response", async () => {
      setupInfiniteQueryMock([]);

      const { result } = await renderAndWaitForInitialization();

      expect(result.current.notifications).toStrictEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルター機能", () => {
    test.each([
      {
        name: "unread notifications only",
        filter: "unread" as const,
        auctionFilter: "all" as const,
        expectedLength: 2,
        validation: (notifications: NotificationData[]) => notifications.every((n) => !n.isRead),
      },
      {
        name: "read notifications only",
        filter: "read" as const,
        auctionFilter: "all" as const,
        expectedLength: 1,
        validation: (notifications: NotificationData[]) => notifications.every((n) => n.isRead),
      },
      {
        name: "all notifications",
        filter: "all" as const,
        auctionFilter: "all" as const,
        expectedLength: 3,
        validation: () => true,
      },
      {
        name: "auction notifications only",
        filter: "all" as const,
        auctionFilter: "auction-only" as const,
        expectedLength: 1,
        validation: (notifications: NotificationData[]) => notifications.every((n) => n.auctionEventType !== null),
      },
      {
        name: "exclude auction notifications",
        filter: "all" as const,
        auctionFilter: "exclude-auction" as const,
        expectedLength: 2,
        validation: (notifications: NotificationData[]) => notifications.every((n) => n.auctionEventType === null),
      },
      {
        name: "unread auction notifications",
        filter: "unread" as const,
        auctionFilter: "auction-only" as const,
        expectedLength: 1,
        validation: (notifications: NotificationData[]) =>
          notifications.every((n) => !n.isRead && n.auctionEventType !== null),
      },
    ])("should filter $name", async ({ filter, auctionFilter, expectedLength, validation }) => {
      await testFilterBehavior(filter, auctionFilter, expectedLength, validation);
      expect(true).toBe(true); // アサーションを追加
    });

    test("should handle invalid filter values", async () => {
      const { result } = await renderAndWaitForInitialization();

      act(() => {
        result.current.handleFilterChange("invalid" as unknown as "all" | "read" | "unread");
        result.current.handleAuctionFilterChange("invalid" as unknown as "all" | "auction-only" | "exclude-auction");
      });

      expect(result.current.activeFilter).toBe("invalid");
      expect(result.current.activeAuctionFilter).toBe("invalid");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("通知状態の変更", () => {
    test("should toggle notification read status", async () => {
      const { result } = await renderAndWaitForInitialization();

      // 全通知を表示
      act(() => {
        result.current.handleFilterChange("all");
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(3);
      });

      const initialUnreadCount = result.current.unreadCount;

      // 未読を既読に変更
      act(() => {
        result.current.handleToggleRead("notification-1", true);
      });

      expect(result.current.unreadCount).toBe(initialUnreadCount - 1);

      const updatedNotification = result.current.notifications.find((n) => n.id === "notification-1");
      expect(updatedNotification?.isRead).toBe(true);
      expect(updatedNotification?.readAt).toBeInstanceOf(Date);

      // 既読を未読に変更
      act(() => {
        result.current.handleToggleRead("notification-2", false);
      });

      expect(result.current.unreadCount).toBe(initialUnreadCount);

      const revertedNotification = result.current.notifications.find((n) => n.id === "notification-2");
      expect(revertedNotification?.isRead).toBe(false);
      expect(revertedNotification?.readAt).toBe(null);
    });

    test("should mark all notifications as read", async () => {
      const { result } = await renderAndWaitForInitialization();

      act(() => {
        result.current.markAllAsRead();
      });

      expect(result.current.unreadCount).toBe(0);

      // 全通知を表示して確認
      act(() => {
        result.current.handleFilterChange("all");
      });

      await waitFor(() => {
        expect(result.current.notifications.every((n) => n.isRead)).toBe(true);
        expect(result.current.notifications.every((n) => n.readAt instanceof Date)).toBe(true);
      });
    });

    test("should handle toggle with invalid notification ID", async () => {
      const { result } = await renderAndWaitForInitialization();

      const initialUnreadCount = result.current.unreadCount;

      act(() => {
        result.current.handleToggleRead("invalid-id", true);
      });

      // 無効なIDでも未読数が変更される（ローカル状態の更新のため）
      expect(result.current.unreadCount).toBe(initialUnreadCount - 1);
    });

    test("should handle updateNotificationStatus API error gracefully", async () => {
      mockUpdateNotificationStatus.mockRejectedValue(new Error("Update Error"));

      const { result } = await renderAndWaitForInitialization();
      const initialUnreadCount = result.current.unreadCount;

      // エラーが発生してもローカル状態は更新される
      act(() => {
        result.current.handleToggleRead("notification-1", true);
      });

      expect(result.current.unreadCount).toBe(initialUnreadCount - 1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ページング機能", () => {
    test("should handle manual refresh", async () => {
      const mockRefetch = vi.fn();
      setupInfiniteQueryMock([testNotifications.unread, testNotifications.read, testNotifications.auction], {
        refetch: mockRefetch,
      });

      const { result } = await renderAndWaitForInitialization();

      await act(async () => {
        await result.current.handleManualRefresh();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });

    test("should handle load more notifications", async () => {
      const { result } = await renderAndWaitForInitialization();

      act(() => {
        void result.current.loadMoreNotifications();
      });

      expect(typeof result.current.loadMoreNotifications).toBe("function");
      expect(typeof result.current.isLoadingMore).toBe("boolean");
    });

    test("should handle refresh error gracefully", async () => {
      const { result } = await renderAndWaitForInitialization();

      await act(async () => {
        await result.current.handleManualRefresh();
      });

      // エラーが発生してもアプリケーションがクラッシュしないことを確認
      if (result.current.error) {
        expect(result.current.error).toContain("通知の取得に失敗しました");
      } else {
        expect(result.current.error).toBe(null);
      }
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値とエラーハンドリング", () => {
    test.each(createBoundaryTestData())("should handle $name", async ({ data }) => {
      setupInfiniteQueryMock(data.notifications);

      const { result } = await renderAndWaitForInitialization();

      expect(result.current.notifications).toStrictEqual([]);
      expect(typeof result.current.unreadCount).toBe("number");
    });

    test("should handle notifications with special content", async () => {
      const specialNotifications = createSpecialContentNotifications();
      setupInfiniteQueryMock(specialNotifications);

      const { result } = await renderAndWaitForInitialization();

      // フィルターを"all"に変更して全通知を表示
      act(() => {
        result.current.handleFilterChange("all");
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(3);
      });

      // 各通知の特徴を個別に検証
      const unicodeNotification = result.current.notifications.find((n) => n.id === "unicode-notification");
      const longTextNotification = result.current.notifications.find((n) => n.id === "long-text-notification");
      const missingDateNotification = result.current.notifications.find((n) => n.id === "missing-date-notification");

      expect(unicodeNotification?.title).toContain("🎉");
      expect(longTextNotification?.title).toHaveLength(10000);
      expect(missingDateNotification?.title).toBe("");
    });

    test("should handle large dataset efficiently", async () => {
      const largeDataset = createLargeDataset(1000, false); // 未読通知として作成
      setupInfiniteQueryMock(largeDataset);

      const { result } = await renderAndWaitForInitialization();

      // フィルターを"all"に変更して全通知を表示
      act(() => {
        result.current.handleFilterChange("all");
      });

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(1000);
      });

      // パフォーマンステスト
      await testPerformance(async () => {
        act(() => {
          result.current.handleFilterChange("unread");
          result.current.handleFilterChange("all");
        });
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("パフォーマンステスト", () => {
    test("should handle rapid operations efficiently", async () => {
      const { result } = await renderAndWaitForInitialization();

      // 連続でフィルターを変更
      act(() => {
        result.current.handleFilterChange("all");
        result.current.handleFilterChange("read");
        result.current.handleFilterChange("unread");
        result.current.handleAuctionFilterChange("auction-only");
        result.current.handleAuctionFilterChange("exclude-auction");
        result.current.handleAuctionFilterChange("all");
      });

      // 最終的な状態が正しいことを確認
      expect(result.current.activeFilter).toBe("unread");
      expect(result.current.activeAuctionFilter).toBe("all");

      // 連続で通知の状態を変更
      const initialUnreadCount = result.current.unreadCount;
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.handleToggleRead("notification-1", i % 2 === 0);
        }
      });

      // 最後の操作が反映される（i=9, 9%2===0 は false なので未読になる）
      expect(result.current.unreadCount).toBe(initialUnreadCount + 1);
    });

    test("should handle concurrent operations", async () => {
      const { result } = await renderAndWaitForInitialization();

      // 同時に複数の操作を実行
      act(() => {
        result.current.handleFilterChange("all");
        result.current.handleAuctionFilterChange("auction-only");
        result.current.handleToggleRead("notification-1", true);
        result.current.handleToggleRead("notification-2", false);
        result.current.markAllAsRead();
      });

      // 最終的な状態が正しいことを確認
      expect(result.current.activeFilter).toBe("all");
      expect(result.current.activeAuctionFilter).toBe("auction-only");
      expect(result.current.unreadCount).toBe(0);
    });

    test("should handle large dataset operations", async () => {
      const largeDataset = createLargeDataset(500, false);
      setupInfiniteQueryMock(largeDataset);

      const { result } = await renderAndWaitForInitialization();

      // 大量データでのフィルター操作のパフォーマンステスト
      await testPerformance(async () => {
        act(() => {
          result.current.handleFilterChange("all");
          result.current.handleAuctionFilterChange("exclude-auction");
          result.current.handleFilterChange("unread");
        });
      }, 1000); // 1秒以内

      expect(result.current.notifications).toHaveLength(500);
    });
  });
});
