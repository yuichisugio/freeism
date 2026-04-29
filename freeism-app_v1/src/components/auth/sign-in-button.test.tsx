import type { SignInResponse } from "next-auth/react";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SignInButton } from "./sign-in-button";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next-auth/reactのモック
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック関数の型定義
 */
const mockSignIn = vi.mocked(signIn);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("SignInButton", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 各テスト前のセットアップ
   */
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトでサインインが成功するようにモック
    mockSignIn.mockResolvedValue({ ok: true } as SignInResponse);
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("初期レンダリング", () => {
    test("should render button with children", () => {
      // Arrange & Act
      render(<SignInButton>サインイン</SignInButton>);

      // Assert
      const button = screen.getByRole("button", { name: "サインイン" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toBeDisabled();
    });

    test("should render button with custom props", () => {
      // Arrange & Act
      render(
        <SignInButton className="custom-class" data-testid="signin-button">
          カスタムボタン
        </SignInButton>,
      );

      // Assert
      const button = screen.getByTestId("signin-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("custom-class");
      expect(button).toHaveTextContent("カスタムボタン");
    });

    test("should render button without children", () => {
      // Arrange & Act
      render(<SignInButton />);

      // Assert
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("サインイン機能", () => {
    test("should call signIn with correct parameters when clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<SignInButton>サインイン</SignInButton>);

      // Act
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert
      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockSignIn).toHaveBeenCalledWith("google", {
        callbackUrl: "/dashboard/group-list",
      });
    });

    test("should show loading state during sign in", async () => {
      // Arrange
      const user = userEvent.setup();
      // サインインを遅延させるためのPromiseを作成
      let resolveSignIn: (value: SignInResponse) => void;
      const signInPromise = new Promise<SignInResponse>((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValue(signInPromise);

      render(<SignInButton>サインイン</SignInButton>);

      // Act
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert - ローディング状態の確認
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("サインイン中...");

      // クリーンアップ - Promiseを解決
      resolveSignIn!({ ok: true } as SignInResponse);
      await signInPromise;
    });

    test("should handle sign in error gracefully", async () => {
      // Arrange
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // コンソールエラーを抑制
      });
      const signInError = new Error("サインインに失敗しました");
      mockSignIn.mockRejectedValue(signInError);

      render(<SignInButton>サインイン</SignInButton>);

      // Act
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert
      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith("サインインに失敗しました:", signInError);

      // クリーンアップ
      consoleErrorSpy.mockRestore();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ローディング状態", () => {
    test("should prevent multiple clicks during loading", async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveSignIn: (value: SignInResponse) => void;
      const signInPromise = new Promise<SignInResponse>((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValue(signInPromise);

      render(<SignInButton>サインイン</SignInButton>);

      // Act
      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button); // 2回目のクリック

      // Assert
      expect(mockSignIn).toHaveBeenCalledTimes(1); // 1回のみ呼ばれる
      expect(button).toBeDisabled();

      // クリーンアップ
      resolveSignIn!({ ok: true } as SignInResponse);
      await signInPromise;
    });

    test("should display correct text during loading", async () => {
      // Arrange
      const user = userEvent.setup();
      let resolveSignIn: (value: SignInResponse) => void;
      const signInPromise = new Promise<SignInResponse>((resolve) => {
        resolveSignIn = resolve;
      });
      mockSignIn.mockReturnValue(signInPromise);

      render(<SignInButton>カスタムテキスト</SignInButton>);

      // Act
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert
      expect(button).toHaveTextContent("サインイン中...");
      expect(button).not.toHaveTextContent("カスタムテキスト");

      // クリーンアップ
      resolveSignIn!({ ok: true } as SignInResponse);
      await signInPromise;
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("プロパティの受け渡し", () => {
    test("should pass through all button props", () => {
      // Arrange & Act
      render(
        <SignInButton id="test-id" className="test-class" disabled aria-label="テストボタン" data-testid="test-button">
          テスト
        </SignInButton>,
      );

      // Assert
      const button = screen.getByTestId("test-button");
      expect(button).toHaveAttribute("id", "test-id");
      expect(button).toHaveClass("test-class");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-label", "テストボタン");
    });

    test("should handle onClick prop correctly", async () => {
      // Arrange
      const user = userEvent.setup();
      const customOnClick = vi.fn();

      render(<SignInButton onClick={customOnClick}>カスタムクリック</SignInButton>);

      // Act
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert
      // propsで渡されたonClickが内部のhandleClickを上書きするため、カスタムのonClickが呼ばれる
      expect(customOnClick).toHaveBeenCalledTimes(1);
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle undefined children", () => {
      // Arrange & Act
      render(<SignInButton>{undefined}</SignInButton>);

      // Assert
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    });

    test("should handle null children", () => {
      // Arrange & Act
      render(<SignInButton>{null}</SignInButton>);

      // Assert
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    });

    test("should handle empty string children", () => {
      // Arrange & Act
      render(<SignInButton>{""}</SignInButton>);

      // Assert
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("");
    });

    test("should handle number children", () => {
      // Arrange & Act
      render(<SignInButton>{123}</SignInButton>);

      // Assert
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("123");
    });
  });
});
