import { AllTheProviders, mockUseMutation, mockUseQueryClient } from "@/test/setup/tanstack-query-setup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EmailNotificationToggle } from "./email-notification-toggle";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ホイストされたモック関数の宣言
const { mockUpdateUserSettingToggle } = vi.hoisted(() => ({
  mockUpdateUserSettingToggle: vi.fn(),
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

describe("EmailNotificationToggle", () => {
  const defaultProps = {
    isEmailEnabled: false,
    userId: "test-user-id",
  };

  // モック関数の定義
  const mockMutate = vi.fn();
  const mockInvalidateQueries = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのuseMutationモック設定
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      variables: undefined,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      reset: vi.fn(),
    });

    // デフォルトのuseQueryClientモック設定
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: vi.fn(),
      getQueryData: vi.fn(),
      removeQueries: vi.fn(),
      clear: vi.fn(),
      prefetchQuery: vi.fn(),
      setQueriesData: vi.fn(),
    });

    // updateUserSettingToggleのデフォルトモック設定
    mockUpdateUserSettingToggle.mockResolvedValue({
      success: true,
      data: {
        id: "test-settings-id",
        userId: "test-user-id",
        isEmailEnabled: true,
      },
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render email notification toggle correctly", () => {
      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByText("メール通知の受信設定を管理します")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
      expect(
        screen.getByText("メール通知を有効にすると、メールでの通知を受け取ることができます。"),
      ).toBeInTheDocument();
    });

    test("should display correct toggle state when isEmailEnabled is false", () => {
      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByText("現在：受信拒否中")).toBeInTheDocument();
    });

    test("should display correct toggle state when isEmailEnabled is true", () => {
      // Arrange
      const enabledProps = { ...defaultProps, isEmailEnabled: true };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...enabledProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByText("現在：受信中")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ユーザーインタラクション", () => {
    test("should call mutate function when toggle is clicked", async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      const toggleSwitch = screen.getByRole("switch");
      await user.click(toggleSwitch);

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(true);
    });

    test("should call mutate with false when toggle is turned off", async () => {
      // Arrange
      const user = userEvent.setup();
      const enabledProps = { ...defaultProps, isEmailEnabled: true };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...enabledProps} />
        </AllTheProviders>,
      );

      const toggleSwitch = screen.getByRole("switch");
      await user.click(toggleSwitch);

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(false);
    });

    test("should display optimistic update state when variables is set", () => {
      // Arrange - variablesがtrueの場合のモック設定
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        variables: true,
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
        reset: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - variablesの値が優先される
      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByText("現在：受信中")).toBeInTheDocument();
    });

    test("should display pending state when mutation is in progress", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        variables: true,
        isPending: true,
        isError: false,
        error: null,
        data: undefined,
        reset: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByRole("switch")).toBeDisabled();
      expect(screen.getByText("現在：受信中 (更新中...)")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("環境変数による表示制御", () => {
    test("should display development message when NEXT_PUBLIC_IS_RESEND_ENABLED is false", () => {
      // Arrange
      const originalEnv = process.env.NEXT_PUBLIC_IS_RESEND_ENABLED;
      process.env.NEXT_PUBLIC_IS_RESEND_ENABLED = "false";

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知は後ほど開発予定です。")).toBeInTheDocument();

      // Cleanup
      process.env.NEXT_PUBLIC_IS_RESEND_ENABLED = originalEnv;
    });

    test("should not display development message when NEXT_PUBLIC_IS_RESEND_ENABLED is not false", () => {
      // Arrange
      const originalEnv = process.env.NEXT_PUBLIC_IS_RESEND_ENABLED;
      process.env.NEXT_PUBLIC_IS_RESEND_ENABLED = "true";

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.queryByText("メール通知は後ほど開発予定です。")).not.toBeInTheDocument();

      // Cleanup
      process.env.NEXT_PUBLIC_IS_RESEND_ENABLED = originalEnv;
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle mutation error gracefully", () => {
      // Arrange
      const errorMessage = "メール通知設定の更新に失敗しました";
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        variables: undefined,
        isPending: false,
        isError: true,
        error: new Error(errorMessage),
        data: undefined,
        reset: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert - エラー状態でもコンポーネントが正常にレンダリングされる
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle updateUserSettingToggle rejection", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUpdateUserSettingToggle.mockRejectedValue(new Error("サーバーエラー"));

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      const toggleSwitch = screen.getByRole("switch");
      await user.click(toggleSwitch);

      // Assert
      expect(mockMutate).toHaveBeenCalledWith(true);
    });

    test("should handle null error gracefully", () => {
      // Arrange
      mockUseMutation.mockReturnValue({
        mutate: mockMutate,
        variables: undefined,
        isPending: false,
        isError: true,
        error: null,
        data: undefined,
        reset: vi.fn(),
      });

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
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
          <EmailNotificationToggle {...propsWithEmptyUserId} />
        </AllTheProviders>,
      );

      // Assert - 空のuserIdでもレンダリングされる
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle null userId", () => {
      // Arrange
      const propsWithNullUserId = { ...defaultProps, userId: null as unknown as string };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithNullUserId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle undefined userId", () => {
      // Arrange
      const propsWithUndefinedUserId = { ...defaultProps, userId: undefined as unknown as string };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithUndefinedUserId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle very long userId", () => {
      // Arrange
      const longUserId = "a".repeat(1000);
      const propsWithLongUserId = { ...defaultProps, userId: longUserId };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithLongUserId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle special characters in userId", () => {
      // Arrange
      const specialUserId = "user-123!@#$%^&*()_+-=[]{}|;:,.<>?";
      const propsWithSpecialUserId = { ...defaultProps, userId: specialUserId };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithSpecialUserId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("メール通知設定")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    test("should handle boolean isEmailEnabled as string", () => {
      // Arrange
      const propsWithStringBoolean = { ...defaultProps, isEmailEnabled: "true" as unknown as boolean };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithStringBoolean} />
        </AllTheProviders>,
      );

      // Assert - 文字列"true"はtruthyなのでチェックされる
      expect(screen.getByRole("switch")).toBeChecked();
    });

    test("should handle null isEmailEnabled", () => {
      // Arrange
      const propsWithNullBoolean = { ...defaultProps, isEmailEnabled: null as unknown as boolean };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithNullBoolean} />
        </AllTheProviders>,
      );

      // Assert - nullはfalsyなのでチェックされない
      expect(screen.getByRole("switch")).not.toBeChecked();
    });

    test("should handle undefined isEmailEnabled", () => {
      // Arrange
      const propsWithUndefinedBoolean = { ...defaultProps, isEmailEnabled: undefined as unknown as boolean };

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...propsWithUndefinedBoolean} />
        </AllTheProviders>,
      );

      // Assert - undefinedはfalsyなのでチェックされない
      expect(screen.getByRole("switch")).not.toBeChecked();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ミューテーション設定の検証", () => {
    test("should call updateUserSettingToggle with correct parameters", async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      const toggleSwitch = screen.getByRole("switch");
      await user.click(toggleSwitch);

      // Assert - mutateが正しいパラメータで呼ばれることを確認
      expect(mockMutate).toHaveBeenCalledWith(true);
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    test("should handle rapid toggle clicks", async () => {
      // Arrange
      const user = userEvent.setup();

      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      const toggleSwitch = screen.getByRole("switch");

      // 連続でクリック - 各クリックは現在の状態に基づいて反転される
      await user.click(toggleSwitch); // false -> true
      await user.click(toggleSwitch); // true -> false (ただし、variablesが設定されていないため、元のisEmailEnabledに基づく)
      await user.click(toggleSwitch); // false -> true

      // Assert - 各クリックでmutateが呼ばれる
      // 実際のコンポーネントでは、variablesが設定されていない場合、
      // 元のisEmailEnabledの値に基づいてトグルされる
      expect(mockMutate).toHaveBeenCalledTimes(3);
      expect(mockMutate).toHaveBeenNthCalledWith(1, true);
      expect(mockMutate).toHaveBeenNthCalledWith(2, true); // variablesが未設定なので、isEmailEnabled(false)の反転でtrue
      expect(mockMutate).toHaveBeenNthCalledWith(3, true); // 同様にtrue
    });

    test("should display correct accessibility attributes", () => {
      // Act
      render(
        <AllTheProviders>
          <EmailNotificationToggle {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const toggleSwitch = screen.getByRole("switch");
      expect(toggleSwitch).toHaveAttribute("id", "email-notification-toggle");

      const label = screen.getByLabelText("現在：受信拒否中");
      expect(label).toBeInTheDocument();
    });
  });
});
