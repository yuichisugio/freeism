"use client";

/**
 * モック関数のインポート
 */
import { getNotificationsAndUnreadCount, getUnreadNotificationsCount } from "@/lib/actions/notification/notification-utilities";
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useNotificationButton } from "./use-notification-button";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// notification-utilities actionsのモック
vi.mock("@/lib/actions/notification/notification-utilities", () => ({
  getNotificationsAndUnreadCount: vi.fn(),
  getUnreadNotificationsCount: vi.fn(),
}));

// next/navigationのモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("Redirect called");
  }),
}));

// next-auth/reactのモック
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

const mockGetNotificationsAndUnreadCount = vi.mocked(getNotificationsAndUnreadCount);
const mockGetUnreadNotificationsCount = vi.mocked(getUnreadNotificationsCount);
const mockUseSession = vi.mocked(useSession);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const mockSession = {
  data: {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
    },
    expires: "2024-12-31T23:59:59.999Z",
  },
  status: "authenticated" as const,
  update: vi.fn(),
};

const mockNotificationsData = {
  notifications: [
    {
      id: "notification-1",
      title: "テスト通知1",
      message: "テストメッセージ1",
      type: "INFO",
      isRead: false,
      sentAt: new Date("2024-01-01T10:00:00Z"),
      readAt: null,
      expiresAt: null,
      userId: "test-user-id",
    },
    {
      id: "notification-2",
      title: "テスト通知2",
      message: "テストメッセージ2",
      type: "WARNING",
      isRead: true,
      sentAt: new Date("2024-01-01T09:00:00Z"),
      readAt: new Date("2024-01-01T09:30:00Z"),
      expiresAt: null,
      userId: "test-user-id",
    },
  ],
  totalCount: 2,
  unreadCount: 1,
  readCount: 1,
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("useNotificationButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockUseSession.mockReturnValue(mockSession);
    mockGetUnreadNotificationsCount.mockResolvedValue(true);
    mockGetNotificationsAndUnreadCount.mockResolvedValue(
      mockNotificationsData as unknown as Awaited<ReturnType<typeof getNotificationsAndUnreadCount>>,
    );
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期化", () => {
    test("should initialize with correct default values", async () => {
      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert - 初期値の確認
      expect(result.current.isOpen).toBe(false);
      expect(result.current.hasUnreadNotifications).toBe(false);
      expect(typeof result.current.setIsOpen).toBe("function");

      // 未読通知の取得完了まで待機
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(true);
      });
    });

    test("should handle authenticated user correctly", async () => {
      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(mockGetUnreadNotificationsCount).toHaveBeenCalledWith("test-user-id");
      });

      expect(result.current.hasUnreadNotifications).toBe(true);
    });

    test("should redirect when user is not authenticated", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      // Act & Assert
      expect(() => {
        renderHook(() => useNotificationButton(), {
          wrapper: AllTheProviders,
        });
      }).toThrow("Redirect called");
    });

    test("should redirect when session data is missing", () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: undefined,
          expires: "2024-12-31T23:59:59.999Z",
        },
        status: "authenticated",
        update: vi.fn(),
      });

      // Act & Assert
      expect(() => {
        renderHook(() => useNotificationButton(), {
          wrapper: AllTheProviders,
        });
      }).toThrow("Redirect called");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("モーダー開閉状態管理", () => {
    test("should update isOpen state when setIsOpen is called", async () => {
      // Arrange
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // 初期状態の確認
      expect(result.current.isOpen).toBe(false);

      // Act - モーダーを開く
      act(() => {
        result.current.setIsOpen(true);
      });

      // Assert
      expect(result.current.isOpen).toBe(true);

      // Act - モーダーを閉じる
      act(() => {
        result.current.setIsOpen(false);
      });

      // Assert
      expect(result.current.isOpen).toBe(false);
    });

    test("should handle multiple state changes correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Act & Assert - 複数回の状態変更
      act(() => {
        result.current.setIsOpen(true);
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setIsOpen(true);
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setIsOpen(false);
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.setIsOpen(false);
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("未読通知の状態管理", () => {
    test("should return true when there are unread notifications", async () => {
      // Arrange
      mockGetUnreadNotificationsCount.mockResolvedValue(true);

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(true);
      });
    });

    test("should return false when there are no unread notifications", async () => {
      // Arrange
      mockGetUnreadNotificationsCount.mockResolvedValue(false);

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(false);
      });
    });

    test("should handle undefined response from getUnreadNotificationsCount", async () => {
      // Arrange
      mockGetUnreadNotificationsCount.mockResolvedValue(undefined as unknown as boolean);

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(false);
      });
    });

    test("should handle null response from getUnreadNotificationsCount", async () => {
      // Arrange
      mockGetUnreadNotificationsCount.mockResolvedValue(null as unknown as boolean);

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(false);
      });
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("通知のプリフェッチ", () => {
    test("should prefetch notifications when hasUnreadNotifications changes", async () => {
      // Assert
      await waitFor(() => {
        expect(mockGetNotificationsAndUnreadCount).toHaveBeenCalledWith(
          "test-user-id",
          1,
          50, // NOTIFICATION_CONSTANTS.ITEMS_PER_PAGE
        );
      });
    });

    test("should handle prefetch error gracefully", async () => {
      // Arrange

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
        // モック実装：何もしない
      });
      mockGetNotificationsAndUnreadCount.mockRejectedValue(new Error("Prefetch failed"));

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert - エラーが発生してもフックは正常に動作する
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(true);
      });

      consoleLogSpy.mockRestore();
    });

    test("should process notification dates correctly in prefetch", async () => {
      // Arrange
      const notificationsWithStringDates = {
        ...mockNotificationsData,
        notifications: mockNotificationsData.notifications.map((notification) => ({
          ...notification,
          sentAt: "2024-01-01T10:00:00Z",
          readAt: notification.readAt ? "2024-01-01T09:30:00Z" : null,
          expiresAt: null,
        })),
      };

      mockGetNotificationsAndUnreadCount.mockResolvedValue(
        notificationsWithStringDates as unknown as Awaited<ReturnType<typeof getNotificationsAndUnreadCount>>,
      );

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(mockGetNotificationsAndUnreadCount).toHaveBeenCalled();
      });

      expect(result.current.hasUnreadNotifications).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle getUnreadNotificationsCount error", async () => {
      // Arrange
      mockGetUnreadNotificationsCount.mockRejectedValue(new Error("API Error"));

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert - エラーが発生してもフックは正常に動作し、デフォルト値を返す
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(false);
      });
    });

    test("should handle missing user ID gracefully", async () => {
      // Arrange
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "",
            email: "test@example.com",
            name: "Test User",
          },
          expires: "2024-12-31T23:59:59.999Z",
        },
        status: "authenticated",
        update: vi.fn(),
      });

      // Act & Assert
      expect(() => {
        renderHook(() => useNotificationButton(), {
          wrapper: AllTheProviders,
        });
      }).toThrow("Redirect called");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty notifications array", async () => {
      // Arrange
      mockGetNotificationsAndUnreadCount.mockResolvedValue({
        notifications: [],
        totalCount: 0,
        unreadCount: 0,
        readCount: 0,
      });

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(mockGetNotificationsAndUnreadCount).toHaveBeenCalled();
      });

      expect(result.current.hasUnreadNotifications).toBe(true); // getUnreadNotificationsCountの結果に依存
    });

    test("should handle large number of notifications", async () => {
      // Arrange
      const largeNotificationsData = {
        notifications: Array.from({ length: 100 }, (_, index) => ({
          id: `notification-${index}`,
          title: `テスト通知${index}`,
          message: `テストメッセージ${index}`,
          type: "INFO",
          isRead: index % 2 === 0,
          sentAt: new Date(`2024-01-01T${String(index % 24).padStart(2, "0")}:00:00Z`),
          readAt: index % 2 === 0 ? new Date(`2024-01-01T${String(index % 24).padStart(2, "0")}:30:00Z`) : null,
          expiresAt: null,
          userId: "test-user-id",
        })),
        totalCount: 100,
        unreadCount: 50,
        readCount: 50,
      };

      mockGetNotificationsAndUnreadCount.mockResolvedValue(
        largeNotificationsData as unknown as Awaited<ReturnType<typeof getNotificationsAndUnreadCount>>,
      );

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(mockGetNotificationsAndUnreadCount).toHaveBeenCalled();
      });

      expect(result.current.hasUnreadNotifications).toBe(true);
    });

    test("should handle notifications with null dates", async () => {
      // Arrange
      const notificationsWithNullDates = {
        ...mockNotificationsData,
        notifications: mockNotificationsData.notifications.map((notification) => ({
          ...notification,
          sentAt: null,
          readAt: null,
          expiresAt: null,
        })),
      };

      mockGetNotificationsAndUnreadCount.mockResolvedValue(
        notificationsWithNullDates as unknown as Awaited<ReturnType<typeof getNotificationsAndUnreadCount>>,
      );

      // Act
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert
      await waitFor(() => {
        expect(mockGetNotificationsAndUnreadCount).toHaveBeenCalled();
      });

      expect(result.current.hasUnreadNotifications).toBe(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should handle complete workflow correctly", async () => {
      // Arrange
      const { result } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Assert - 初期状態
      expect(result.current.isOpen).toBe(false);
      expect(result.current.hasUnreadNotifications).toBe(false);

      // 未読通知の取得完了まで待機
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(true);
      });

      // Act - モーダーを開く
      act(() => {
        result.current.setIsOpen(true);
      });

      // Assert - モーダーが開いている
      expect(result.current.isOpen).toBe(true);
      expect(result.current.hasUnreadNotifications).toBe(true);

      // Act - モーダーを閉じる
      act(() => {
        result.current.setIsOpen(false);
      });

      // Assert - モーダーが閉じている
      expect(result.current.isOpen).toBe(false);
      expect(result.current.hasUnreadNotifications).toBe(true);
    });

    test("should maintain state consistency across re-renders", async () => {
      // Arrange
      const { result, rerender } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // Act - 状態を変更
      act(() => {
        result.current.setIsOpen(true);
      });

      // Assert - 再レンダー前の状態
      expect(result.current.isOpen).toBe(true);

      // Act - 再レンダー
      rerender();

      // Assert - 再レンダー後も状態が保持されている
      expect(result.current.isOpen).toBe(true);
      expect(typeof result.current.setIsOpen).toBe("function");
    });

    test("should handle session changes correctly", async () => {
      // Arrange
      const { result, rerender } = renderHook(() => useNotificationButton(), {
        wrapper: AllTheProviders,
      });

      // 初期状態の確認
      await waitFor(() => {
        expect(result.current.hasUnreadNotifications).toBe(true);
      });

      // Act - セッションを変更（新しいユーザー）
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: "new-user-id",
            email: "newuser@example.com",
            name: "New User",
          },
          expires: "2024-12-31T23:59:59.999Z",
        },
        status: "authenticated",
        update: vi.fn(),
      });

      rerender();

      // Assert - 新しいユーザーIDで通知が取得される
      await waitFor(() => {
        expect(mockGetUnreadNotificationsCount).toHaveBeenCalledWith("new-user-id");
      });
    });
  });
});
