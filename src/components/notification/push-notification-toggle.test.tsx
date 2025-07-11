import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { WebPushNotificationToggle } from "./push-notification-toggle";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ホイストされたモック関数の宣言
const { mockUsePushNotification, mockUpdateUserSettingToggle } = vi.hoisted(() => ({
  mockUsePushNotification: vi.fn(),
  mockUpdateUserSettingToggle: vi.fn(),
}));

// usePushNotificationフックのモック
vi.mock("@/hooks/notification/use-push-notification", () => ({
  usePushNotification: mockUsePushNotification,
}));

// updateUserSettingToggleアクションのモック
vi.mock("@/lib/actions/user-settings", () => ({
  updateUserSettingToggle: mockUpdateUserSettingToggle,
}));

// queryCacheKeysのモック
vi.mock("@/lib/tanstack-query", () => ({
  queryCacheKeys: {
    userSettings: {
      userAll: vi.fn((userId: string) => ["userSettings", userId]),
    },
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("WebPushNotificationToggle", () => {
  const defaultProps = {
    isLoading: false,
    isPushEnabled: false,
    userId: "test-user-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのusePushNotificationモック設定
    mockUsePushNotification.mockReturnValue({
      isSupported: true,
      subscriptionState: null,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      error: null,
      permissionState: "default",
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render push notification toggle when supported", () => {
      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("プッシュ通知設定")).toBeInTheDocument();
      expect(screen.getByText("プッシュ通知の受信設定を管理します")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should render unsupported message when not supported", () => {
      // Arrange
      mockUsePushNotification.mockReturnValue({
        isSupported: false,
        subscriptionState: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "default",
      });

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("通知設定")).toBeInTheDocument();
      expect(screen.getByText("このブラウザはプッシュ通知をサポートしていません")).toBeInTheDocument();
      expect(screen.getByText("最新のChromeやSafariなどのモダンブラウザでご利用ください")).toBeInTheDocument();
    });

    test("should display correct toggle state based on props", () => {
      // Arrange - プッシュ通知が有効な状態
      const enabledProps = { ...defaultProps, isPushEnabled: true };

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...enabledProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByText("現在：受信中")).toBeInTheDocument();
    });

    test("should display disabled state when isPushEnabled is false", () => {
      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByText("現在：受信拒否中")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should display error message when push hook has error", () => {
      // Arrange
      const errorMessage = "プッシュ通知の初期化に失敗しました";
      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: new Error(errorMessage),
        permissionState: "default",
      });

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText(`エラー: ${errorMessage}`)).toBeInTheDocument();
    });

    test("should display warning when permission is denied", () => {
      // Arrange
      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "denied",
      });

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(
        screen.getByText(
          "ブラウザの通知設定が「拒否」されています。プッシュ通知を有効にするには、ブラウザの設定を変更してください。",
        ),
      ).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ブラウザ状態の同期", () => {
    test("should sync enabled state with browser when permission is granted and subscription exists", async () => {
      // Arrange
      const mockSubscription = { endpoint: "test-endpoint" };
      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: mockSubscription,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "granted",
      });

      // propsでisPushEnabled: trueを設定し、ブラウザ状態と一致させる
      const enabledProps = { ...defaultProps, isPushEnabled: true };

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...enabledProps} />
        </AllTheProviders>,
      );

      // Assert - ブラウザの状態とpropsが一致している場合、トグルが有効になっている
      await waitFor(() => {
        expect(screen.getByRole("switch")).toBeChecked();
      });
      expect(screen.getByText("現在：受信中")).toBeInTheDocument();
    });

    test("should sync disabled state when permission is granted but no subscription", () => {
      // Arrange
      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "granted",
      });

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - 許可されているが購読がない場合は無効
      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByText("現在：受信拒否中")).toBeInTheDocument();
    });

    test("should display correct state when permission is default", () => {
      // Arrange
      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "default",
      });

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - デフォルト状態では無効
      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByText("現在：受信拒否中")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle empty userId", () => {
      // Arrange
      const propsWithEmptyUserId = { ...defaultProps, userId: "" };

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...propsWithEmptyUserId} />
        </AllTheProviders>,
      );

      // Assert - 空のuserIdでもレンダリングされる
      expect(screen.getByText("プッシュ通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle null subscription state", () => {
      // Arrange
      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: null,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "granted",
      });

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByText("現在：受信拒否中")).toBeInTheDocument();
    });

    test("should display help text for users", () => {
      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - ヘルプテキストが表示される
      expect(
        screen.getByText("プッシュ通知を有効にすると、アプリ内での通知を受け取ることができます。"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "アプリの通知設定は、このToggleでONにできますが、通知を受け取るにはchrome自体の通知設定もONにしてください。",
        ),
      ).toBeInTheDocument();
    });

    test("should handle complex subscription object", () => {
      // Arrange
      const complexSubscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/complex-endpoint",
        expirationTime: null,
        options: { userVisibleOnly: true },
        getKey: vi.fn(),
        toJSON: vi.fn(),
        unsubscribe: vi.fn(),
      };

      mockUsePushNotification.mockReturnValue({
        isSupported: true,
        subscriptionState: complexSubscription,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        error: null,
        permissionState: "granted",
      });

      const enabledProps = { ...defaultProps, isPushEnabled: true };

      // Act
      render(
        <AllTheProviders>
          <WebPushNotificationToggle {...enabledProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByText("現在：受信中")).toBeInTheDocument();
    });
  });
});
