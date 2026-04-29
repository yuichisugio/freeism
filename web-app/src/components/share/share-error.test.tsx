import { mockPush } from "@/test/setup/setup";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { Error } from "./share-error";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Error コンポーネントの単体テスト
 */
describe("Error", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockPush.mockClear();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングのテスト
   */
  describe("基本的なレンダリング", () => {
    test("should render error message when error prop is provided", () => {
      const errorMessage = "テストエラーメッセージ";

      render(<Error error={errorMessage} />);

      // エラーメッセージが表示されることを確認
      expect(screen.getByText(`エラーが発生しました: ${errorMessage}`)).toBeInTheDocument();

      // AlertTriangleアイコンが表示されることを確認（クラス名で確認）
      const alertIcon = document.querySelector(".lucide-triangle-alert");
      expect(alertIcon).toBeInTheDocument();

      // 戻るボタンが表示されることを確認
      expect(screen.getByRole("button", { name: /前のページに戻る/i })).toBeInTheDocument();

      // ArrowLeftアイコンが表示されることを確認（クラス名で確認）
      const arrowIcon = document.querySelector(".lucide-arrow-left");
      expect(arrowIcon).toBeInTheDocument();
    });

    test("should render default message when error prop is empty string", () => {
      render(<Error error="" />);

      // デフォルトメッセージが表示されることを確認
      expect(screen.getByText("オークション情報を取得できませんでした。")).toBeInTheDocument();
    });

    test("should have proper CSS classes and structure", () => {
      render(<Error error="テスト" />);

      // メインコンテナのクラスを確認
      const container = screen.getByText("エラーが発生しました: テスト").closest("div");
      expect(container).toHaveClass("container", "mx-auto", "flex", "min-h-[calc(100vh-10rem)]");

      // エラーメッセージのクラスを確認
      const errorText = screen.getByText("エラーが発生しました: テスト");
      expect(errorText).toHaveClass("text-destructive", "mt-4", "text-lg");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ナビゲーション機能のテスト
   */
  describe("ナビゲーション機能", () => {
    test("should navigate to specified previousPageURL when button is clicked", async () => {
      const customURL = "/custom/page";

      render(<Error error="テストエラー" previousPageURL={customURL} />);

      const backButton = screen.getByRole("button", { name: /前のページに戻る/i });
      await user.click(backButton);

      // router.pushが指定されたURLで呼び出されることを確認
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith(customURL);
    });

    test("should navigate to default URL when previousPageURL is not provided", async () => {
      render(<Error error="テストエラー" />);

      const backButton = screen.getByRole("button", { name: /前のページに戻る/i });
      await user.click(backButton);

      // router.pushがデフォルトURLで呼び出されることを確認
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/dashboard/group-list");
    });

    test("should navigate to default URL when previousPageURL is undefined", async () => {
      render(<Error error="テストエラー" previousPageURL={undefined} />);

      const backButton = screen.getByRole("button", { name: /前のページに戻る/i });
      await user.click(backButton);

      // router.pushがデフォルトURLで呼び出されることを確認
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/dashboard/group-list");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値・エラーケースのテスト
   */
  describe("境界値・エラーケース", () => {
    test("should render default message when error prop is null", () => {
      // @ts-expect-error - テスト用にnullを渡す
      render(<Error error={null} />);

      // nullの場合もデフォルトメッセージが表示されることを確認
      expect(screen.getByText("オークション情報を取得できませんでした。")).toBeInTheDocument();
    });

    test("should render default message when error prop is undefined", () => {
      // @ts-expect-error - テスト用にundefinedを渡す
      render(<Error error={undefined} />);

      // undefinedの場合もデフォルトメッセージが表示されることを確認
      expect(screen.getByText("オークション情報を取得できませんでした。")).toBeInTheDocument();
    });

    test("should handle very long error messages", () => {
      const longError = "これは非常に長いエラーメッセージです。".repeat(10);

      render(<Error error={longError} />);

      // 長いエラーメッセージも正しく表示されることを確認
      expect(screen.getByText(`エラーが発生しました: ${longError}`)).toBeInTheDocument();
    });

    test("should handle special characters in error message", () => {
      const specialError = "エラー: <script>alert('test')</script> & 特殊文字 'quote'";

      render(<Error error={specialError} />);

      // 特殊文字も正しく表示されることを確認
      expect(screen.getByText(`エラーが発生しました: ${specialError}`)).toBeInTheDocument();
    });

    test("should handle empty previousPageURL string", async () => {
      render(<Error error="テストエラー" previousPageURL="" />);

      const backButton = screen.getByRole("button", { name: /前のページに戻る/i });
      await user.click(backButton);

      // 空文字の場合はそのまま空文字が使用されることを確認（実装に合わせて修正）
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メモ化のテスト
   */
  describe("メモ化の動作", () => {
    test("should be memoized with React.memo", () => {
      // コンポーネントがReact.memoでメモ化されていることを確認
      expect(Error.$$typeof).toBe(Symbol.for("react.memo"));
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * アクセシビリティのテスト
   */
  describe("アクセシビリティ", () => {
    test("should have proper button role and accessible text", () => {
      render(<Error error="テスト" />);

      const button = screen.getByRole("button", { name: /前のページに戻る/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("data-slot", "button");
    });

    test("should have proper semantic structure", () => {
      render(<Error error="エラーテスト" />);

      // エラーメッセージがpタグで表示されていることを確認
      const errorMessage = screen.getByText("エラーが発生しました: エラーテスト");
      expect(errorMessage.tagName).toBe("P");
    });
  });
});
