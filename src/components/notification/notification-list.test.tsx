import type { NotificationManagerResult } from "@/hooks/notification/use-notification-list";
import type { NotificationData } from "@/lib/actions/cache/cache-notification-utilities";
import { faker } from "@faker-js/faker";
import { AuctionEventType, NotificationTargetType } from "@prisma/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { Factory } from "fishery";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { NotificationList } from "./notification-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseNotificationList, mockUseShortcut } = vi.hoisted(() => ({
  mockUseNotificationList: vi.fn(),
  mockUseShortcut: vi.fn(),
}));

// useNotificationListフックのモック
vi.mock("@/hooks/notification/use-notification-list", () => ({
  useNotificationList: mockUseNotificationList,
}));

// useShortcutフックのモック
vi.mock("@/hooks/utils/use-shortcut", () => ({
  useShortcut: mockUseShortcut,
}));

// cnユーティリティ関数のモック
vi.mock("@/lib/utils", () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

// date-fnsのモック
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "2分前"),
}));

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
  isRead: params.isRead ?? false,
  sentAt: params.sentAt ?? faker.date.recent(),
  readAt: params.readAt ?? null,
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

// デフォルトのuseNotificationListの戻り値を作成
const createDefaultNotificationManagerResult = (
  overrides: Partial<NotificationManagerResult> = {},
): NotificationManagerResult => ({
  notifications: [],
  isLoading: false,
  isLoadingMore: false,
  isRefreshing: false,
  error: null,
  unreadCount: 0,
  readHasMore: false,
  unReadHasMore: false,
  activeFilter: "unread",
  activeAuctionFilter: "all",
  markAllAsRead: vi.fn(),
  handleFilterChange: vi.fn(),
  handleAuctionFilterChange: vi.fn(),
  handleManualRefresh: vi.fn(),
  loadMoreNotifications: vi.fn(),
  handleToggleRead: vi.fn(),
  ...overrides,
});

// 特定パターンの通知データ作成
const createTestNotifications = () => ({
  unread: notificationFactory.build({
    id: "notification-1",
    title: "未読通知1",
    isRead: false,
    auctionEventType: null,
  }),
  read: notificationFactory.build({
    id: "notification-2",
    title: "既読通知1",
    isRead: true,
    auctionEventType: null,
  }),
  auction: notificationFactory.build({
    id: "notification-3",
    title: "オークション通知",
    isRead: false,
    auctionEventType: AuctionEventType.AUCTION_WIN,
    auctionId: "auction-1",
  }),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("NotificationList", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック実装を設定
    mockUseNotificationList.mockReturnValue(createDefaultNotificationManagerResult());
    mockUseShortcut.mockImplementation(() => {
      // ショートカットフックのモック実装
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render notification list component", () => {
      render(<NotificationList />);

      // フィルタータブが表示されることを確認
      expect(screen.getByText("全て")).toBeInTheDocument();
      expect(screen.getByText("未読")).toBeInTheDocument();
      expect(screen.getByText("既読")).toBeInTheDocument();
    });

    test("should render loading state", () => {
      mockUseNotificationList.mockReturnValue(createDefaultNotificationManagerResult({ isLoading: true }));

      render(<NotificationList />);

      expect(screen.getByText("通知を読み込み中...")).toBeInTheDocument();
    });

    test("should render error state", () => {
      const errorMessage = "通知の取得に失敗しました";
      mockUseNotificationList.mockReturnValue(createDefaultNotificationManagerResult({ error: errorMessage }));

      render(<NotificationList />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText("再度読み込む")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("通知リストの表示", () => {
    test("should render notifications when data is available", () => {
      const testNotifications = createTestNotifications();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [testNotifications.unread, testNotifications.read],
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("未読通知1")).toBeInTheDocument();
      expect(screen.getByText("既読通知1")).toBeInTheDocument();
    });

    test("should render empty state when no notifications", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [],
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("通知はありません")).toBeInTheDocument();
    });

    test("should render empty state for unread filter", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [],
          activeFilter: "unread",
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("未読の通知はありません")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フィルター機能", () => {
    test("should call handleFilterChange when filter tab is clicked", () => {
      const mockHandleFilterChange = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          handleFilterChange: mockHandleFilterChange,
        }),
      );

      render(<NotificationList />);

      fireEvent.click(screen.getByText("全て"));
      expect(mockHandleFilterChange).toHaveBeenCalledWith("all");
    });

    test("should display unread count badge", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          unreadCount: 5,
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    test("should not display unread count badge when count is 0", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          unreadCount: 0,
        }),
      );

      render(<NotificationList />);

      // 未読数が0の場合はバッジが表示されない
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    test("should call handleFilterChange for each filter tab", () => {
      const mockHandleFilterChange = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          handleFilterChange: mockHandleFilterChange,
        }),
      );

      render(<NotificationList />);

      // 各フィルタータブをクリック
      fireEvent.click(screen.getByText("全て"));
      expect(mockHandleFilterChange).toHaveBeenCalledWith("all");

      fireEvent.click(screen.getByText("未読"));
      expect(mockHandleFilterChange).toHaveBeenCalledWith("unread");

      fireEvent.click(screen.getByText("既読"));
      expect(mockHandleFilterChange).toHaveBeenCalledWith("read");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("オークションフィルター機能", () => {
    test("should render auction filter controls", () => {
      render(<NotificationList />);

      expect(screen.getByText("すべて")).toBeInTheDocument();
      expect(screen.getByText("オークションのみ")).toBeInTheDocument();
      expect(screen.getByText("オークション以外")).toBeInTheDocument();
    });

    test("should call handleAuctionFilterChange when auction filter is clicked", () => {
      const mockHandleAuctionFilterChange = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          handleAuctionFilterChange: mockHandleAuctionFilterChange,
        }),
      );

      render(<NotificationList />);

      fireEvent.click(screen.getByText("オークションのみ"));
      expect(mockHandleAuctionFilterChange).toHaveBeenCalledWith("auction-only");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("手動更新機能", () => {
    test("should call handleManualRefresh when refresh button is clicked", () => {
      const mockHandleManualRefresh = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          handleManualRefresh: mockHandleManualRefresh,
        }),
      );

      render(<NotificationList />);

      // 手動更新ボタンを探してクリック
      const refreshButton = screen.getByRole("button", { name: "手動更新" });
      fireEvent.click(refreshButton);

      expect(mockHandleManualRefresh).toHaveBeenCalledTimes(1);
    });

    test("should show loading state during refresh", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          isRefreshing: true,
        }),
      );

      render(<NotificationList />);

      // リフレッシュ中のローディングアイコンが表示されることを確認
      expect(screen.getByRole("button", { name: "手動更新" })).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("全て既読機能", () => {
    test("should show mark all as read button when there are unread notifications", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          unreadCount: 3,
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("すべて既読にする")).toBeInTheDocument();
    });

    test("should not show mark all as read button when no unread notifications", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          unreadCount: 0,
        }),
      );

      render(<NotificationList />);

      expect(screen.queryByText("すべて既読にする")).not.toBeInTheDocument();
    });

    test("should call markAllAsRead when button is clicked", () => {
      const mockMarkAllAsRead = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          unreadCount: 3,
          markAllAsRead: mockMarkAllAsRead,
        }),
      );

      render(<NotificationList />);

      fireEvent.click(screen.getByText("すべて既読にする"));
      expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("通知アイテムの表示", () => {
    test("should render notification items with correct content", () => {
      const testNotifications = createTestNotifications();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [testNotifications.unread],
        }),
      );

      render(<NotificationList />);

      // 通知のタイトルとメッセージが表示されることを確認
      expect(screen.getByText("未読通知1")).toBeInTheDocument();
      expect(screen.getByText(testNotifications.unread.message)).toBeInTheDocument();
    });

    test("should show auction event type for auction notifications", () => {
      const testNotifications = createTestNotifications();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [testNotifications.auction],
        }),
      );

      render(<NotificationList />);

      // オークション通知の場合、イベントタイプが表示されることを確認
      expect(screen.getByText("オークション: 落札")).toBeInTheDocument();
    });

    test("should call handleToggleRead when read/unread button is clicked", () => {
      const mockHandleToggleRead = vi.fn();
      const testNotifications = createTestNotifications();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [testNotifications.unread],
          handleToggleRead: mockHandleToggleRead,
        }),
      );

      render(<NotificationList />);

      // 既読ボタンをクリック
      fireEvent.click(screen.getByText("既読にする"));
      expect(mockHandleToggleRead).toHaveBeenCalledWith("notification-1", true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("もっと読み込む機能", () => {
    test("should show load more button when hasMore is true (with notifications)", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [createTestNotifications().unread],
          readHasMore: true,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("もっと読み込む")).toBeInTheDocument();
    });

    test("should show load more button when hasMore is true (empty state)", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [],
          readHasMore: true,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("もっと読み込む")).toBeInTheDocument();
    });

    test("should call loadMoreNotifications when load more button is clicked (with notifications)", () => {
      const mockLoadMoreNotifications = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [createTestNotifications().unread],
          readHasMore: true,
          loadMoreNotifications: mockLoadMoreNotifications,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      fireEvent.click(screen.getByText("もっと読み込む"));
      expect(mockLoadMoreNotifications).toHaveBeenCalledTimes(1);
    });

    test("should call loadMoreNotifications when load more button is clicked (empty state)", () => {
      const mockLoadMoreNotifications = vi.fn();
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [],
          readHasMore: true,
          loadMoreNotifications: mockLoadMoreNotifications,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      fireEvent.click(screen.getByText("もっと読み込む"));
      expect(mockLoadMoreNotifications).toHaveBeenCalledTimes(1);
    });

    test("should show loading state for load more button (with notifications)", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [createTestNotifications().unread],
          readHasMore: true,
          isLoadingMore: true,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    });

    test("should show loading state for load more button (empty state)", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [],
          readHasMore: true,
          isLoadingMore: true,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    });

    test("should not show load more button when hasMore is false", () => {
      mockUseNotificationList.mockReturnValue(
        createDefaultNotificationManagerResult({
          notifications: [],
          readHasMore: false,
          unReadHasMore: false,
          activeFilter: "all",
        }),
      );

      render(<NotificationList />);

      expect(screen.queryByText("もっと読み込む")).not.toBeInTheDocument();
      expect(screen.getByText("通知はありません")).toBeInTheDocument();
    });
  });
});
