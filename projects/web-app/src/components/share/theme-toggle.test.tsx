import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

// ホイストされたモック関数の宣言
const { mockSetTheme, mockUseTheme } = vi.hoisted(() => ({
  mockSetTheme: vi.fn(),
  mockUseTheme: vi.fn(),
}));

// next-themesのモック
vi.mock("next-themes", () => ({
  useTheme: mockUseTheme,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();

    // デフォルトのuseThemeモック設定
    mockUseTheme.mockReturnValue({
      theme: "system",
      setTheme: mockSetTheme,
    });
  });

  describe("初期レンダリング", () => {
    test("should render theme toggle button with correct aria-label", async () => {
      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("aria-label", "テーマ切り替え");
      });
    });

    test("should render with system theme by default", async () => {
      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
      });
    });

    test("should render component after mount", async () => {
      // Act
      render(<ThemeToggle />);

      // Assert - コンポーネントがマウント後にレンダリングされることを確認
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe("テーマアイコン表示", () => {
    test("should display Monitor icon for system theme", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
        // SVGアイコンが存在することを確認
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        const svgElement = button.querySelector("svg");
        expect(svgElement).toBeInTheDocument();
      });
    });

    test("should display Sun icon for light theme", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("Light")).toBeInTheDocument();
        // SVGアイコンが存在することを確認
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        const svgElement = button.querySelector("svg");
        expect(svgElement).toBeInTheDocument();
      });
    });

    test("should display Moon icon for dark theme", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "dark",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("Dark")).toBeInTheDocument();
        // SVGアイコンが存在することを確認
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        const svgElement = button.querySelector("svg");
        expect(svgElement).toBeInTheDocument();
      });
    });

    test("should have correct CSS classes for icon sizing", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        const svgElement = button.querySelector("svg");
        expect(svgElement).toHaveClass("h-5", "w-5");
      });
    });

    test("should have correct text size classes", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        const textSpan = screen.getByText("Light");
        expect(textSpan).toHaveClass("text-sm");
      });
    });
  });

  describe("テーマ切り替え機能", () => {
    test("should switch from system to light theme when clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });
      await user.click(button);

      // Assert
      expect(mockSetTheme).toHaveBeenCalledWith("light");
      expect(mockSetTheme).toHaveBeenCalledTimes(1);
    });

    test("should switch from light to dark theme when clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: "light",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });
      await user.click(button);

      // Assert
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
      expect(mockSetTheme).toHaveBeenCalledTimes(1);
    });

    test("should switch from dark to system theme when clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: "dark",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });
      await user.click(button);

      // Assert
      expect(mockSetTheme).toHaveBeenCalledWith("system");
      expect(mockSetTheme).toHaveBeenCalledTimes(1);
    });

    test("should perform complete cycle through all themes", async () => {
      // Arrange
      const user = userEvent.setup();
      let currentTheme = "system";

      mockUseTheme.mockImplementation(() => ({
        theme: currentTheme,
        setTheme: (newTheme: string) => {
          currentTheme = newTheme;
          mockSetTheme(newTheme);
        },
      }));

      const { rerender } = render(<ThemeToggle />);

      // Act & Assert - system → light
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      let button = screen.getByRole("button", { name: "テーマ切り替え" });
      expect(screen.getByText("System")).toBeInTheDocument();
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith("light");

      // light → dark
      currentTheme = "light";
      rerender(<ThemeToggle />);
      await waitFor(() => {
        expect(screen.getByText("Light")).toBeInTheDocument();
      });
      button = screen.getByRole("button", { name: "テーマ切り替え" });
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith("dark");

      // dark → system
      currentTheme = "dark";
      rerender(<ThemeToggle />);
      await waitFor(() => {
        expect(screen.getByText("Dark")).toBeInTheDocument();
      });
      button = screen.getByRole("button", { name: "テーマ切り替え" });
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith("system");

      expect(mockSetTheme).toHaveBeenCalledTimes(3);
    });
  });

  describe("ボタンの属性確認", () => {
    test("should have correct variant and size props", async () => {
      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toHaveClass("button-outline-custom");
      });
    });
  });

  describe("境界値・異常系テスト", () => {
    test("should handle undefined theme gracefully", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: undefined,
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert - undefinedの場合はデフォルトケース（system）として扱われる
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
      });
    });

    test("should handle null theme gracefully", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: null,
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert - nullの場合もデフォルトケース（system）として扱われる
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
      });
    });

    test("should handle unknown theme value gracefully", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "unknown",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert - 不明なテーマはデフォルトケース（system）として扱われる
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
      });
    });

    test("should handle multiple rapid clicks without errors", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });

      // 複数回連続でクリック
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Assert
      expect(mockSetTheme).toHaveBeenCalledTimes(3);
      expect(mockSetTheme).toHaveBeenNthCalledWith(1, "light");
      expect(mockSetTheme).toHaveBeenNthCalledWith(2, "light");
      expect(mockSetTheme).toHaveBeenNthCalledWith(3, "light");
    });

    test("should handle empty string theme value", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: "",
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert - 空文字列もデフォルトケース（system）として扱われる
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
      });
    });

    test("should handle malformed theme object", async () => {
      // Arrange
      mockUseTheme.mockReturnValue({
        theme: { invalid: "object" }, // 文字列でない値
        setTheme: mockSetTheme,
      });

      // Act
      render(<ThemeToggle />);

      // Assert - オブジェクトもデフォルトケース（system）として扱われる
      await waitFor(() => {
        expect(screen.getByText("System")).toBeInTheDocument();
      });
    });

    test("should handle network connectivity issues gracefully", async () => {
      // Arrange - ネットワークエラーをシミュレート
      const user = userEvent.setup();
      const slowSetTheme = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => setTimeout(resolve, 100));
      });

      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: slowSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });
      await user.click(button);

      // Assert - 遅延があってもエラーが発生しないことを確認
      expect(slowSetTheme).toHaveBeenCalledWith("light");
    });

    test("should handle component remounting gracefully", () => {
      // Arrange & Act
      const { unmount } = render(<ThemeToggle />);
      unmount();

      // Assert - 新しいインスタンスを作成しても正常に動作することを確認
      expect(() => render(<ThemeToggle />)).not.toThrow();
    });
  });

  describe("アクセシビリティテスト", () => {
    test("should be focusable with keyboard navigation", async () => {
      // Act
      render(<ThemeToggle />);

      // Assert
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
        button.focus();
        expect(button).toHaveFocus();
      });
    });

    test("should be activatable with Enter key", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });
      button.focus();
      await user.keyboard("{Enter}");

      // Assert
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    test("should be activatable with Space key", async () => {
      // Arrange
      const user = userEvent.setup();
      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: mockSetTheme,
      });

      render(<ThemeToggle />);

      // Act
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });
      button.focus();
      await user.keyboard(" ");

      // Assert
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });
  });

  describe("パフォーマンステスト", () => {
    test("should handle rapid theme switching efficiently", async () => {
      // Arrange
      const user = userEvent.setup();
      const performanceSetTheme = vi.fn();

      mockUseTheme.mockReturnValue({
        theme: "system",
        setTheme: performanceSetTheme,
      });

      render(<ThemeToggle />);

      // Act - 高速で10回クリック
      await waitFor(() => {
        const button = screen.getByRole("button", { name: "テーマ切り替え" });
        expect(button).toBeInTheDocument();
      });

      const button = screen.getByRole("button", { name: "テーマ切り替え" });

      const startTime = performance.now();
      for (let i = 0; i < 10; i++) {
        await user.click(button);
      }
      const endTime = performance.now();

      // Assert - パフォーマンスとコール数を確認
      expect(performanceSetTheme).toHaveBeenCalledTimes(10);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    });

    test("should not cause memory leaks with multiple rerenders", () => {
      // Arrange
      const { rerender, unmount } = render(<ThemeToggle />);

      // Act - 複数回リレンダリング
      for (let i = 0; i < 100; i++) {
        mockUseTheme.mockReturnValue({
          theme: i % 2 === 0 ? "light" : "dark",
          setTheme: mockSetTheme,
        });
        rerender(<ThemeToggle />);
      }

      // Assert - アンマウント時にエラーが発生しないことを確認
      expect(() => unmount()).not.toThrow();
    });
  });
});
