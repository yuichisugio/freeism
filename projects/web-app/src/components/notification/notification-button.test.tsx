import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { NotificationButton } from "./notification-button";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseNotificationButton, mockUseShortcut } = vi.hoisted(() => ({
  mockUseNotificationButton: vi.fn(),
  mockUseShortcut: vi.fn(),
}));

// useNotificationButtonフックのモック
vi.mock("@/hooks/notification/use-notification-button", () => ({
  useNotificationButton: mockUseNotificationButton,
}));

// useShortcutフックのモック
vi.mock("@/hooks/utils/use-shortcut", () => ({
  useShortcut: mockUseShortcut,
}));

// NotificationListコンポーネントのモック
vi.mock("./notification-list", () => ({
  NotificationList: () => <div data-testid="notification-list">Notification List</div>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("NotificationButton", () => {
  // デフォルトのモック戻り値
  const defaultMockReturn = {
    isOpen: false,
    setIsOpen: vi.fn(),
    hasUnreadNotifications: false,
  };

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのモック戻り値を設定
    mockUseNotificationButton.mockReturnValue(defaultMockReturn);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("基本的なレンダリング", () => {
    test("should render notification button", () => {
      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });
      expect(button).toBeInTheDocument();
    });

    test("should render Bell icon", () => {
      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });
      const bellIcon = button.querySelector("svg");
      expect(bellIcon).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("未読通知バッジの表示", () => {
    test("should not show badge when no unread notifications", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        hasUnreadNotifications: false,
      });

      render(<NotificationButton />);

      const redDot = document.querySelector(".bg-red-500");
      expect(redDot).not.toBeInTheDocument();
    });

    test("should show badge when has unread notifications", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        hasUnreadNotifications: true,
      });

      render(<NotificationButton />);

      const redDot = document.querySelector(".bg-red-500");
      expect(redDot).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("モーダル開閉機能", () => {
    test("should not show modal when isOpen is false", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        isOpen: false,
      });

      render(<NotificationButton />);

      const modal = screen.queryByRole("dialog");
      expect(modal).not.toBeInTheDocument();
    });

    test("should show modal when isOpen is true", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        isOpen: true,
      });

      render(<NotificationButton />);

      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
      expect(screen.getByText("通知")).toBeInTheDocument();
      expect(screen.getByTestId("notification-list")).toBeInTheDocument();
    });

    test("should call setIsOpen when button is clicked", () => {
      const mockSetIsOpen = vi.fn();
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        setIsOpen: mockSetIsOpen,
      });

      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });
      fireEvent.click(button);

      expect(mockSetIsOpen).toHaveBeenCalledWith(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("キーボードショートカット", () => {
    test("should register shortcut with correct configuration", () => {
      render(<NotificationButton />);

      expect(mockUseShortcut).toHaveBeenCalledWith([
        {
          code: "KeyN",
          alt: true,
          callback: expect.any(Function) as () => void,
          preventDefault: true,
        },
      ]);
    });

    test("should call useShortcut hook", () => {
      render(<NotificationButton />);

      // useShortcutが呼ばれたことを確認
      expect(mockUseShortcut).toHaveBeenCalledTimes(1);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("アクセシビリティ", () => {
    test("should have correct aria-label", () => {
      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });
      expect(button).toHaveAttribute("aria-label", "通知");
    });

    test("should have correct button role", () => {
      render(<NotificationButton />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("スタイリング", () => {
    test("should have correct button classes", () => {
      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });
      expect(button).toHaveClass("relative", "h-9", "w-9", "rounded-full");
    });

    test("should have correct icon classes", () => {
      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });
      const bellIcon = button.querySelector("svg");
      expect(bellIcon).toHaveClass("h-[18px]", "w-[18px]");
    });

    test("should have correct badge positioning when shown", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        hasUnreadNotifications: true,
      });

      render(<NotificationButton />);

      const badge = document.querySelector(".bg-red-500");
      expect(badge).toHaveClass("absolute", "top-1.5", "right-1.5", "h-2.5", "w-2.5", "rounded-full");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("統合テスト", () => {
    test("should work with both unread notifications and open modal", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        isOpen: true,
        hasUnreadNotifications: true,
      });

      render(<NotificationButton />);

      // ボタンが存在している（aria-hiddenでも要素は存在する）
      const button = document.querySelector('button[aria-label="通知"]');
      expect(button).toBeInTheDocument();

      // バッジが表示されている
      const badge = document.querySelector(".bg-red-500");
      expect(badge).toBeInTheDocument();

      // モーダルが表示されている
      const modal = screen.getByRole("dialog");
      expect(modal).toBeInTheDocument();
      expect(screen.getByText("通知")).toBeInTheDocument();
      expect(screen.getByTestId("notification-list")).toBeInTheDocument();
    });

    test("should handle multiple button clicks", () => {
      const mockSetIsOpen = vi.fn();
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        setIsOpen: mockSetIsOpen,
      });

      render(<NotificationButton />);

      const button = screen.getByRole("button", { name: "通知" });

      // 複数回クリック
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockSetIsOpen).toHaveBeenCalledTimes(3);
      expect(mockSetIsOpen).toHaveBeenCalledWith(true);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラーハンドリング", () => {
    test("should handle missing setIsOpen function gracefully", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        setIsOpen: undefined,
      });

      // エラーが発生しないことを確認
      expect(() => render(<NotificationButton />)).not.toThrow();
    });

    test("should handle undefined hasUnreadNotifications", () => {
      mockUseNotificationButton.mockReturnValue({
        ...defaultMockReturn,
        hasUnreadNotifications: undefined,
      });

      render(<NotificationButton />);

      // バッジが表示されないことを確認
      const badge = document.querySelector(".bg-red-500");
      expect(badge).not.toBeInTheDocument();
    });
  });
});
