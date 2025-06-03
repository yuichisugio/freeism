"use client";

import { usePushNotification } from "@/hooks/notification/use-push-notification";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PushNotificationProvider } from "./push-notification-provider";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// usePushNotificationフックのモック
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock("@/hooks/notification/use-push-notification", () => ({
  usePushNotification: vi.fn(),
}));

const mockUsePushNotification = vi.mocked(usePushNotification);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータ
 */
const defaultHookReturnValue = {
  isInitialized: true,
  registrationState: null,
  subscriptionState: null,
  isSupported: true,
  error: null,
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  permissionState: "default" as NotificationPermission,
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("PushNotificationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // subscribe関数がPromiseを返すようにモック設定
    mockSubscribe.mockResolvedValue(null);
    mockUnsubscribe.mockResolvedValue(true);
    // デフォルトのモック戻り値を設定
    mockUsePushNotification.mockReturnValue(defaultHookReturnValue);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render children correctly", () => {
      // Arrange
      const testContent = "Test Content";

      // Act
      render(
        <PushNotificationProvider>
          <div>{testContent}</div>
        </PushNotificationProvider>,
      );

      // Assert
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    test("should call usePushNotification hook", () => {
      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // Assert
      expect(mockUsePushNotification).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("useEffect条件分岐テスト", () => {
    test("should trigger subscribe when all conditions are met", async () => {
      // Arrange
      vi.useFakeTimers();
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "default" as NotificationPermission,
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);

      // Promiseの処理を待つ
      await vi.runAllTimersAsync();

      // Assert
      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    test("should not trigger subscribe when not initialized", async () => {
      // Arrange
      vi.useFakeTimers();
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: false, // 初期化未完了
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test("should not trigger subscribe when not supported", async () => {
      // Arrange
      vi.useFakeTimers();
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isSupported: false, // サポートされていない
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test("should not trigger subscribe when already subscribed", async () => {
      // Arrange
      vi.useFakeTimers();
      const mockSubscriptionState = {} as PushSubscription;
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        subscriptionState: mockSubscriptionState, // 既に購読済み
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test("should not trigger subscribe when permission is not default", async () => {
      // Arrange
      vi.useFakeTimers();
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        permissionState: "granted" as NotificationPermission, // デフォルト以外
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリングテスト", () => {
    test("should handle subscribe error gracefully", async () => {
      // Arrange
      vi.useFakeTimers();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // モック実装（何もしない）
      });
      const subscribeError = new Error("Subscribe failed");
      mockSubscribe.mockRejectedValue(subscribeError);

      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "default" as NotificationPermission,
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith("PushNotificationProvider: subscribe() failed:", subscribeError);

      consoleErrorSpy.mockRestore();
      vi.useRealTimers();
    });

    test("should not call subscribe when subscribe function is falsy", async () => {
      // Arrange
      vi.useFakeTimers();
      const mockNullSubscribe = null as unknown as () => Promise<PushSubscription | null>;
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        subscribe: mockNullSubscribe, // subscribe関数がnull
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "default" as NotificationPermission,
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("クリーンアップテスト", () => {
    test("should clear timer on unmount", async () => {
      // Arrange
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "default" as NotificationPermission,
      });

      // Act
      const { unmount } = render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // コンポーネントをアンマウント（タイマーが実行される前に）
      unmount();

      // 3秒進める（タイマーがクリアされているので実行されないはず）
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(mockSubscribe).not.toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
      vi.useRealTimers();
    });

    test("should clear timer when conditions change before timeout", async () => {
      // Arrange
      vi.useFakeTimers();
      const { rerender } = render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 最初は条件を満たす状態
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "default" as NotificationPermission,
      });

      // 1秒進める（まだタイマーは実行されない）
      vi.advanceTimersByTime(1000);

      // 条件を変更（既に購読済みに変更）
      const mockSubscriptionState = {} as PushSubscription;
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: true,
        isSupported: true,
        subscriptionState: mockSubscriptionState, // 購読済みに変更
        permissionState: "default" as NotificationPermission,
      });

      // 再レンダリング
      rerender(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 残りの2秒を進める
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled(); // 条件が変わったので実行されない

      vi.useRealTimers();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle permission state 'denied'", async () => {
      // Arrange
      vi.useFakeTimers();
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "denied" as NotificationPermission, // 拒否状態
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test("should handle undefined subscribe function", async () => {
      // Arrange
      vi.useFakeTimers();
      const mockUndefinedSubscribe = undefined as unknown as () => Promise<PushSubscription | null>;
      mockUsePushNotification.mockReturnValue({
        ...defaultHookReturnValue,
        subscribe: mockUndefinedSubscribe, // subscribe関数がundefined
        isInitialized: true,
        isSupported: true,
        subscriptionState: null,
        permissionState: "default" as NotificationPermission,
      });

      // Act
      render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 3秒進める
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockSubscribe).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test("should handle multiple rapid re-renders", async () => {
      // Arrange
      vi.useFakeTimers();
      const { rerender } = render(
        <PushNotificationProvider>
          <div>Test</div>
        </PushNotificationProvider>,
      );

      // 複数回の再レンダリング
      for (let i = 0; i < 5; i++) {
        mockUsePushNotification.mockReturnValue({
          ...defaultHookReturnValue,
          isInitialized: true,
          isSupported: true,
          subscriptionState: null,
          permissionState: "default" as NotificationPermission,
        });

        rerender(
          <PushNotificationProvider>
            <div>Test {i}</div>
          </PushNotificationProvider>,
        );

        // 少し時間を進める
        vi.advanceTimersByTime(500);
      }

      // 最終的に3秒経過させる
      vi.advanceTimersByTime(3000);
      await vi.runAllTimersAsync();

      // Assert
      // 最後のタイマーのみが実行されるはず
      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
