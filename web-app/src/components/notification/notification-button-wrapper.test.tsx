// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

import { useBreakpoint } from "@/hooks/utils/use-breakpoint";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { NotificationButtonWrapper } from "./notification-button-wrapper";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// useBreakpointフックのモック
vi.mock("@/hooks/utils/use-breakpoint");

// NotificationButtonコンポーネントのモック
vi.mock("./notification-button", () => ({
  NotificationButton: () => <div data-testid="notification-button">Notification Button</div>,
}));

// Next.js dynamicのモック
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="notification-button">Notification Button</div>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("NotificationButtonWrapper", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常系テスト", () => {
    test("should render NotificationButton when isMobile is true and screen is small", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should render NotificationButton when isMobile is false and screen is large", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: true });

      // Act
      render(<NotificationButtonWrapper isMobile={false} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should not render NotificationButton when isMobile is true and screen is large", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: true });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();
    });

    test("should not render NotificationButton when isMobile is false and screen is small", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={false} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("マウント状態テスト", () => {
    test("should handle component mounting correctly", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - マウント後は正しくレンダリングされる
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should call useBreakpoint hook", () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      // Assert - useBreakpointが呼ばれることを確認
      expect(useBreakpoint).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle exactly 640px breakpoint (isSmUp: true)", async () => {
      // Arrange - 640px以上の境界値
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: true });

      // Act
      render(<NotificationButtonWrapper isMobile={false} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should handle just below 640px breakpoint (isSmUp: false)", async () => {
      // Arrange - 640px未満の境界値
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系・エッジケーステスト", () => {
    test("should handle undefined isSmUp value", async () => {
      // Arrange - 異常な値
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: undefined as unknown as boolean });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - undefinedの場合はfalsyとして扱われ、!bp.isSmUpがtrueになるため、isMobile=trueの場合は表示される
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should handle null isSmUp value", async () => {
      // Arrange - 異常な値
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: null as unknown as boolean });

      // Act
      render(<NotificationButtonWrapper isMobile={false} />);

      // useEffectの実行を待つ
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - nullの場合はfalsyとして扱われるため、表示されない
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();
    });

    test("should handle useBreakpoint throwing error", () => {
      // Arrange - useBreakpointがエラーを投げる場合
      vi.mocked(useBreakpoint).mockImplementation(() => {
        throw new Error("useBreakpoint error");
      });

      // Act & Assert - エラーが発生することを確認
      expect(() => {
        render(<NotificationButtonWrapper isMobile={true} />);
      }).toThrow("useBreakpoint error");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("動的変更テスト", () => {
    test("should re-render when isMobile prop changes", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act - 初期レンダリング
      const { rerender } = render(<NotificationButtonWrapper isMobile={false} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - 初期状態では表示されない
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();

      // Act - propsを変更
      rerender(<NotificationButtonWrapper isMobile={true} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - props変更後は表示される
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should re-render when breakpoint changes", async () => {
      // Arrange - 初期状態
      const mockUseBreakpoint = vi.mocked(useBreakpoint);
      mockUseBreakpoint.mockReturnValue({ isSmUp: false });

      // Act - 初期レンダリング
      const { rerender } = render(<NotificationButtonWrapper isMobile={false} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - 初期状態では表示されない
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();

      // Act - ブレークポイントを変更
      mockUseBreakpoint.mockReturnValue({ isSmUp: true });
      rerender(<NotificationButtonWrapper isMobile={false} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - ブレークポイント変更後は表示される
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("shouldShowロジックテスト", () => {
    test("should show when isSmUp is true and isMobile is false", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: true });

      // Act
      render(<NotificationButtonWrapper isMobile={false} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - (true && !false) || (false && false) = true || false = true
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should show when isSmUp is false and isMobile is true", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - (false && !true) || (true && true) = false || true = true
      expect(screen.getByTestId("notification-button")).toBeInTheDocument();
    });

    test("should not show when isSmUp is true and isMobile is true", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: true });

      // Act
      render(<NotificationButtonWrapper isMobile={true} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - (true && !true) || (false && true) = false || false = false
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();
    });

    test("should not show when isSmUp is false and isMobile is false", async () => {
      // Arrange
      vi.mocked(useBreakpoint).mockReturnValue({ isSmUp: false });

      // Act
      render(<NotificationButtonWrapper isMobile={false} />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Assert - (false && !false) || (true && false) = false || false = false
      expect(screen.queryByTestId("notification-button")).not.toBeInTheDocument();
    });
  });
});
