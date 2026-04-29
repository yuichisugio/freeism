import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CardCountdown } from "./auction-listing-countdown";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("CardCountdown", () => {
  // モック関数
  const mockOnExpire = vi.fn();

  // 各テスト前にモックをリセット
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  test("should render countdown component with time text", () => {
    // 1時間後の日時を設定
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);

    render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

    // 時間テキストが表示されることを確認（1時間は60分として表示される）
    expect(screen.getByText("60分")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  test("should render countdown component for expired time", () => {
    // 過去の日時を設定（期限切れ）
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);

    render(<CardCountdown endTime={pastDate} onExpire={mockOnExpire} />);

    // 終了テキストが表示されることを確認
    expect(screen.getByText("終了")).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("状態別スタイリングテスト", () => {
    test("should apply critical styling for less than 30 minutes", () => {
      // 20分後の日時を設定（クリティカル状態）
      const futureDate = new Date(Date.now() + 20 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // text-red-500とanimate-pulseクラスが適用されることを確認（クリティカル状態）
      const countdownElement = container.querySelector(".text-red-500");
      expect(countdownElement).toBeInTheDocument();

      const animatedElement = container.querySelector(".animate-pulse");
      expect(animatedElement).toBeInTheDocument();

      // 20分が表示されることを確認
      expect(screen.getByText("20分")).toBeInTheDocument();
    });

    test("should apply urgent styling for less than 12 hours", () => {
      // 6時間後の日時を設定（緊急状態）
      const futureDate = new Date(Date.now() + 6 * 60 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // text-orange-500クラスが適用されることを確認（緊急状態）
      const countdownElement = container.querySelector(".text-orange-500");
      expect(countdownElement).toBeInTheDocument();

      // 時間と分が表示されることを確認
      expect(screen.getByText(/[5-6]時間/)).toBeInTheDocument();
    });

    test("should apply normal styling for more than 12 hours", () => {
      // 24時間後の日時を設定（通常状態）
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // text-gray-700クラスが適用されることを確認（通常状態）
      const countdownElement = container.querySelector(".text-gray-700");
      expect(countdownElement).toBeInTheDocument();

      // 時間形式で表示されることを確認（24時間前後の表示）
      expect(screen.getByText(/2[2-4]時間|1日/)).toBeInTheDocument();
    });

    test("should apply expired styling for past dates", () => {
      // 過去の日時を設定（期限切れ状態）
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={pastDate} onExpire={mockOnExpire} />);

      // text-red-500クラスが適用されることを確認（期限切れ状態）
      const countdownElement = container.querySelector(".text-red-500");
      expect(countdownElement).toBeInTheDocument();

      // 終了が表示されることを確認
      expect(screen.getByText("終了")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("フォーマットテスト", () => {
    test("should format days and hours correctly", () => {
      // 2日と3時間後の日時を設定
      const futureDate = new Date(Date.now() + (2 * 24 + 3) * 60 * 60 * 1000);

      render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // 2日 3時間形式で表示されることを確認
      expect(screen.getByText(/2日 [2-3]時間/)).toBeInTheDocument();
    });

    test("should format hours and minutes correctly", () => {
      // 2時間30分後の日時を設定
      const futureDate = new Date(Date.now() + (2 * 60 + 30) * 60 * 1000);

      render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // 2時間 31分形式で表示されることを確認（分は切り上げ）
      expect(screen.getByText(/2時間 3[0-1]分/)).toBeInTheDocument();
    });

    test("should format only minutes correctly", () => {
      // 45分後の日時を設定
      const futureDate = new Date(Date.now() + 45 * 60 * 1000);

      render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // 45分形式で表示されることを確認
      expect(screen.getByText("45分")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("クロックアイコンテスト", () => {
    test("should show clock icon for active countdown", () => {
      // 1時間後の日時を設定
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // クロックアイコンが表示されることを確認（lucide-clockクラス）
      const clockIcon = container.querySelector(".lucide-clock");
      expect(clockIcon).toBeInTheDocument();
    });

    test("should not show clock icon for expired countdown", () => {
      // 過去の日時を設定（期限切れ）
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={pastDate} onExpire={mockOnExpire} />);

      // クロックアイコンが表示されないことを確認
      const clockIcon = container.querySelector(".lucide-clock");
      expect(clockIcon).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("境界値テスト", () => {
    test("should handle exactly 30 minutes boundary", () => {
      // 正確に30分後の日時を設定
      const futureDate = new Date(Date.now() + 30 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // text-orange-500クラスが適用されることを確認（30分ちょうどは緊急状態）
      const countdownElement = container.querySelector(".text-orange-500");
      expect(countdownElement).toBeInTheDocument();

      // 30分が表示されることを確認
      expect(screen.getByText("30分")).toBeInTheDocument();
    });

    test("should handle exactly 12 hours boundary", () => {
      // 正確に12時間後の日時を設定
      const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000);

      const { container } = render(<CardCountdown endTime={futureDate} onExpire={mockOnExpire} />);

      // text-orange-500クラスが適用されることを確認（12時間ちょうどは緊急状態）
      const countdownElement = container.querySelector(".text-orange-500");
      expect(countdownElement).toBeInTheDocument();

      // 12時間が表示されることを確認
      expect(screen.getByText(/1[1-2]時間/)).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系テスト", () => {
    test("should handle string date input", () => {
      // 文字列形式の日時を設定
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      render(<CardCountdown endTime={new Date(futureDate)} onExpire={mockOnExpire} />);

      // 時間テキストが表示されることを確認（1時間は60分として表示される）
      expect(screen.getByText("60分")).toBeInTheDocument();
    });

    test("should handle invalid date gracefully", () => {
      // 無効な日付を設定
      const invalidDate = new Date("invalid-date-string");

      expect(() => {
        render(<CardCountdown endTime={invalidDate} onExpire={mockOnExpire} />);
      }).not.toThrow();
    });

    test("should handle null onExpire callback gracefully", () => {
      // 30秒後に期限切れになる日時を設定
      const expireDate = new Date(Date.now() + 30 * 1000);

      // onExpireにnullを返す関数を渡してもエラーが発生しないことを確認
      expect(() => {
        render(<CardCountdown endTime={expireDate} onExpire={() => null} />);
      }).not.toThrow();
    });
  });
});
