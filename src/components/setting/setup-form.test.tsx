import type { UserSettings } from "@prisma/client";
import { AllTheProviders, mockUseMutation, mockUseQuery, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SetupForm } from "./setup-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ホイストされたモック関数の宣言
const { mockUseSession, mockRefresh } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockRefresh: vi.fn(),
}));

// モック設定
vi.mock("@/lib/actions/user-settings", () => ({
  updateUserSetup: vi.fn(),
}));

vi.mock("@/lib/auction/action/user", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/components/notification/email-notification-toggle", () => ({
  EmailNotificationToggle: ({ isEmailEnabled, userId }: { isEmailEnabled: boolean; userId: string }) => (
    <div data-testid="email-notification-toggle">
      Email Toggle - Enabled: {String(isEmailEnabled)} - User: {userId}
    </div>
  ),
}));

vi.mock("@/components/notification/push-notification-toggle", () => ({
  WebPushNotificationToggle: ({ isPushEnabled, userId }: { isPushEnabled: boolean; userId: string }) => (
    <div data-testid="push-notification-toggle">
      Push Toggle - Enabled: {String(isPushEnabled)} - User: {userId}
    </div>
  ),
}));

vi.mock("@/components/share/form/form-field", () => ({
  CustomFormField: ({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) => (
    <div data-testid={`form-field-${name}`}>
      <label>{label}</label>
      <input name={name} placeholder={placeholder} />
    </div>
  ),
}));

vi.mock("@/components/share/form/form-layout", () => ({
  FormLayout: ({ children, submitLabel }: { children: React.ReactNode; submitLabel: string }) => (
    <form data-testid="form-layout">
      {children}
      <button type="submit">{submitLabel}</button>
    </form>
  ),
}));

// Next.js navigation のモック
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
  redirect: vi.fn(() => {
    throw new Error("Redirect called");
  }),
}));

// Next-auth/react のモック
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// テストデータ
const mockUserId = "test-user-id";
const mockUserSettings: UserSettings = {
  id: "settings-id",
  userId: mockUserId,
  username: "テストユーザー",
  lifeGoal: "テスト目標",
  isEmailEnabled: true,
  isPushEnabled: false,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("SetupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockUseSession.mockReturnValue({
      data: { user: { id: mockUserId } },
      status: "authenticated",
    });

    mockUseQuery.mockReturnValue({
      data: mockUserSettings,
      isLoading: false,
      error: null,
    });

    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    });

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
      setQueryData: vi.fn(),
    });
  });

  describe("基本レンダリング", () => {
    test("should render setup form with user settings", async () => {
      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("現在の設定")).toBeInTheDocument();
        expect(screen.getByText("テストユーザー")).toBeInTheDocument();
        expect(screen.getByText("テスト目標")).toBeInTheDocument();
        expect(screen.getByTestId("email-notification-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("push-notification-toggle")).toBeInTheDocument();
        expect(screen.getByText("変更内容")).toBeInTheDocument();
      });
    });

    test("should render setup form without user settings", async () => {
      // Arrange - ユーザー設定が存在しない場合
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("ユーザー設定")).toBeInTheDocument();
        expect(screen.getByText("ユーザー設定がありません。")).toBeInTheDocument();
        expect(screen.getByTestId("email-notification-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("push-notification-toggle")).toBeInTheDocument();
        expect(screen.getByText("変更内容")).toBeInTheDocument();
      });
    });

    test("should show loading state", async () => {
      // Arrange - ローディング状態
      mockUseQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("email-notification-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("push-notification-toggle")).toBeInTheDocument();
        expect(screen.getByText("変更内容")).toBeInTheDocument();
      });
    });
  });

  describe("認証エラー", () => {
    test("should redirect when user is not authenticated", async () => {
      // Arrange - 未認証状態
      mockUseSession.mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      // Act & Assert - redirectが呼ばれることを期待
      expect(() => {
        render(
          <AllTheProviders>
            <SetupForm />
          </AllTheProviders>,
        );
      }).toThrow("Redirect called");
    });

    test("should redirect when user ID is missing", async () => {
      // Arrange - ユーザーIDが存在しない場合
      mockUseSession.mockReturnValue({
        data: { user: { id: undefined } },
        status: "authenticated",
      });

      // Act & Assert - redirectが呼ばれることを期待
      expect(() => {
        render(
          <AllTheProviders>
            <SetupForm />
          </AllTheProviders>,
        );
      }).toThrow("Redirect called");
    });
  });

  describe("通知トグルコンポーネント", () => {
    test("should render email notification toggle with correct props", async () => {
      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        const emailToggle = screen.getByTestId("email-notification-toggle");
        expect(emailToggle).toBeInTheDocument();
        expect(emailToggle).toHaveTextContent("Email Toggle - Enabled: true - User: test-user-id");
      });
    });

    test("should render push notification toggle with correct props", async () => {
      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        const pushToggle = screen.getByTestId("push-notification-toggle");
        expect(pushToggle).toBeInTheDocument();
        expect(pushToggle).toHaveTextContent("Push Toggle - Enabled: false - User: test-user-id");
      });
    });
  });

  describe("フォームフィールド", () => {
    test("should render username and lifeGoal form fields", async () => {
      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("form-field-username")).toBeInTheDocument();
        expect(screen.getByTestId("form-field-lifeGoal")).toBeInTheDocument();
        // フォーム内の特定のラベルを検証
        const usernameField = screen.getByTestId("form-field-username");
        expect(usernameField).toHaveTextContent("ユーザー名");
        const lifeGoalField = screen.getByTestId("form-field-lifeGoal");
        expect(lifeGoalField).toHaveTextContent("自分の人生の目標");
      });
    });

    test("should render submit button", async () => {
      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("設定を保存")).toBeInTheDocument();
      });
    });
  });

  describe("フォーム送信", () => {
    test("should call mutation when form is submitted", async () => {
      // Arrange
      const mockMutate = vi.fn();
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        variables: undefined,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // FormLayoutコンポーネントがonSubmitを呼び出すことを確認
      await waitFor(() => {
        expect(screen.getByTestId("form-layout")).toBeInTheDocument();
      });

      // Assert - FormLayoutがレンダリングされることを確認
      expect(screen.getByTestId("form-layout")).toBeInTheDocument();
    });

    test("should show pending state during mutation", async () => {
      // Arrange - 送信中の状態
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        variables: { username: "新しいユーザー名", lifeGoal: "新しい目標" },
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert - optimistic updateの確認
      await waitFor(() => {
        expect(screen.getByTestId("form-layout")).toBeInTheDocument();
      });
    });
  });

  describe("エラーハンドリング", () => {
    test("should handle query error", async () => {
      // Arrange - クエリエラー状態
      mockUseQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch user settings"),
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert - エラー状態でもコンポーネントがレンダリングされることを確認
      await waitFor(() => {
        expect(screen.getByText("ユーザー設定がありません。")).toBeInTheDocument();
        expect(screen.getByTestId("email-notification-toggle")).toBeInTheDocument();
        expect(screen.getByTestId("push-notification-toggle")).toBeInTheDocument();
      });
    });
  });

  describe("最終更新日の表示", () => {
    test("should display last updated date when user settings exist", async () => {
      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("最終更新日")).toBeInTheDocument();
        expect(screen.getByText("2024/1/2")).toBeInTheDocument();
      });
    });

    test("should not display last updated date when pending", async () => {
      // Arrange - 送信中の状態
      mockUseMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        variables: { username: "新しいユーザー名", lifeGoal: "新しい目標" },
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert - isPendingの場合は最終更新日が表示されない
      await waitFor(() => {
        expect(screen.queryByText("最終更新日")).not.toBeInTheDocument();
      });
    });
  });

  describe("境界値テスト", () => {
    test("should handle user settings with minimum values", async () => {
      // Arrange - 最小値のユーザー設定
      const minUserSettings: UserSettings = {
        id: "min-settings-id",
        userId: mockUserId,
        username: "ab", // 最小2文字
        lifeGoal: "cd", // 最小2文字
        isEmailEnabled: false,
        isPushEnabled: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockUseQuery.mockReturnValue({
        data: minUserSettings,
        isLoading: false,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("ab")).toBeInTheDocument();
        expect(screen.getByText("cd")).toBeInTheDocument();
      });
    });

    test("should handle user settings with maximum values", async () => {
      // Arrange - 最大値のユーザー設定
      const maxUserSettings: UserSettings = {
        id: "max-settings-id",
        userId: mockUserId,
        username: "a".repeat(40), // 最大40文字
        lifeGoal: "b".repeat(200), // 最大200文字
        isEmailEnabled: true,
        isPushEnabled: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockUseQuery.mockReturnValue({
        data: maxUserSettings,
        isLoading: false,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("a".repeat(40))).toBeInTheDocument();
        expect(screen.getByText("b".repeat(200))).toBeInTheDocument();
      });
    });
  });

  describe("特殊文字・エンコーディングテスト", () => {
    test("should handle Japanese characters", async () => {
      // Arrange - 日本語文字のユーザー設定
      const japaneseUserSettings: UserSettings = {
        id: "japanese-settings-id",
        userId: mockUserId,
        username: "日本語ユーザー",
        lifeGoal: "日本語の目標です",
        isEmailEnabled: true,
        isPushEnabled: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockUseQuery.mockReturnValue({
        data: japaneseUserSettings,
        isLoading: false,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("日本語ユーザー")).toBeInTheDocument();
        expect(screen.getByText("日本語の目標です")).toBeInTheDocument();
      });
    });

    test("should handle special characters", async () => {
      // Arrange - 特殊文字のユーザー設定
      const specialCharUserSettings: UserSettings = {
        id: "special-settings-id",
        userId: mockUserId,
        username: "user@123!",
        lifeGoal: "目標: 成功への道のり (2024年)",
        isEmailEnabled: false,
        isPushEnabled: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockUseQuery.mockReturnValue({
        data: specialCharUserSettings,
        isLoading: false,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("user@123!")).toBeInTheDocument();
        expect(screen.getByText("目標: 成功への道のり (2024年)")).toBeInTheDocument();
      });
    });

    test("should handle emoji characters", async () => {
      // Arrange - 絵文字のユーザー設定
      const emojiUserSettings: UserSettings = {
        id: "emoji-settings-id",
        userId: mockUserId,
        username: "ユーザー😊",
        lifeGoal: "幸せになる🌟✨",
        isEmailEnabled: true,
        isPushEnabled: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockUseQuery.mockReturnValue({
        data: emojiUserSettings,
        isLoading: false,
        error: null,
      });

      // Act
      render(
        <AllTheProviders>
          <SetupForm />
        </AllTheProviders>,
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText("ユーザー😊")).toBeInTheDocument();
        expect(screen.getByText("幸せになる🌟✨")).toBeInTheDocument();
      });
    });
  });
});
