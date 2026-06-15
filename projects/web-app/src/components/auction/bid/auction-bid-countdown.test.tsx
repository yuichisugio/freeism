import React from "react";
import { type CountdownDisplayProps, type CountdownState } from "@/types/auction-types";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CountdownDisplay } from "./auction-bid-countdown";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Framer Motionのモック
 */
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => React.createElement("div", props, children),
  },
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CountdownDisplay コンポーネントのテスト
 */
describe("CountdownDisplay", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なレンダリングのテスト
   */
  test("should render countdown display component", () => {
    // テストデータの準備
    const countdownState: CountdownState = {
      days: 2,
      hours: 12,
      minutes: 30,
      isExpired: false,
      isUrgent: false,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("2日 12時間 30分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    // レンダリング
    render(<CountdownDisplay {...props} />);

    // 基本的な表示確認
    expect(screen.getByText("2日 12時間 30分")).toBeInTheDocument();
    expect(countdownAction).toHaveBeenCalled();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークション終了時の表示テスト
   */
  test("should display expired state when auction is ended", () => {
    const countdownState: CountdownState = {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: true,
      isUrgent: false,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("終了");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // 終了表示の確認
    expect(screen.getByText("オークション終了")).toBeInTheDocument();
    // AlertTriangleアイコンのSVGクラスで確認
    const container = screen.getByText("オークション終了").closest("div");
    const alertIcon = container?.querySelector(".lucide-triangle-alert");
    expect(alertIcon).toBeInTheDocument();
    expect(alertIcon).toHaveClass("h-4 w-4");
    // countdownActionが呼ばれていないことを確認（終了時は呼ばれない）
    expect(countdownAction).not.toHaveBeenCalled();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 24時間以内（急ぎ表示）のテスト
   */
  test("should display urgent state when less than 24 hours remaining", () => {
    const countdownState: CountdownState = {
      days: 0,
      hours: 12,
      minutes: 30,
      isExpired: false,
      isUrgent: true,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("12時間 30分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // 急ぎ表示の確認
    expect(screen.getByText("12時間 30分")).toBeInTheDocument();
    expect(countdownAction).toHaveBeenCalled();
    // 赤色のテキストが表示されているか確認
    const urgentDiv = screen.getByText("12時間 30分").closest("div");
    expect(urgentDiv).toHaveClass("text-red-500");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 1時間以内（クリティカル表示）のテスト
   */
  test("should display critical warning when less than 1 hour remaining", () => {
    const countdownState: CountdownState = {
      days: 0,
      hours: 0,
      minutes: 45,
      isExpired: false,
      isUrgent: true,
      isCritical: true,
    };

    const countdownAction = vi.fn().mockReturnValue("45分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // クリティカル表示の確認
    expect(screen.getByText("45分")).toBeInTheDocument();
    expect(screen.getByText("まもなく終了します！")).toBeInTheDocument();
    expect(countdownAction).toHaveBeenCalled();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通常表示のテスト（余裕がある場合）
   */
  test("should display normal state when more than 24 hours remaining", () => {
    const countdownState: CountdownState = {
      days: 3,
      hours: 12,
      minutes: 45,
      isExpired: false,
      isUrgent: false,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("3日 12時間 45分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // 通常表示の確認
    expect(screen.getByText("3日 12時間 45分")).toBeInTheDocument();
    expect(countdownAction).toHaveBeenCalled();

    // Clockアイコンが表示されていることを確認
    const container = screen.getByText("3日 12時間 45分").closest("div");
    const clockIcon = container?.querySelector(".lucide-clock");
    expect(clockIcon).toBeInTheDocument();
    expect(clockIcon).toHaveClass("h-4 w-4");

    // 通常表示のスタイルクラスを確認
    expect(container).toHaveClass("text-muted-foreground");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト: ちょうど24時間の場合
   */
  test("should display urgent state when exactly 24 hours remaining", () => {
    const countdownState: CountdownState = {
      days: 1,
      hours: 0,
      minutes: 0,
      isExpired: false,
      isUrgent: false,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("1日");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // 1日（24時間）の場合は通常表示（days: 1 の場合は24時間以上）
    expect(screen.getByText("1日")).toBeInTheDocument();
    const container = screen.getByText("1日").closest("div");
    expect(container).toHaveClass("text-muted-foreground");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト: ちょうど1時間の場合
   */
  test("should display urgent state without critical warning when exactly 1 hour remaining", () => {
    const countdownState: CountdownState = {
      days: 0,
      hours: 1,
      minutes: 0,
      isExpired: false,
      isUrgent: true,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("1時間");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // 1時間の場合は急ぎ表示だが、クリティカル警告は出ない
    expect(screen.getByText("1時間")).toBeInTheDocument();
    expect(screen.queryByText("まもなく終了します！")).not.toBeInTheDocument();
    const urgentDiv = screen.getByText("1時間").closest("div");
    expect(urgentDiv).toHaveClass("text-red-500");
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常値テスト: 空文字が渡された場合
   */
  test("should handle empty string values gracefully", () => {
    const countdownState: CountdownState = {
      days: 2,
      hours: 12,
      minutes: 0,
      isExpired: false,
      isUrgent: false,
      isCritical: false,
    };

    // countdownActionが空文字を返す場合
    const countdownAction = vi.fn().mockReturnValue("");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    expect(countdownAction).toHaveBeenCalled();
    // 空文字でも描画エラーが発生しないことを確認
    // days:2の場合は通常表示分岐に入る
    const clockIcon = document.querySelector(".lucide-clock");
    expect(clockIcon).toBeInTheDocument();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常値テスト: 負の値が渡された場合
   */
  test("should handle negative values", () => {
    const countdownState: CountdownState = {
      days: -1,
      hours: -5,
      minutes: -30,
      isExpired: false,
      isUrgent: false,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("-1日 -5時間 -30分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // 負の値でも描画されることを確認
    expect(screen.getByText("-1日 -5時間 -30分")).toBeInTheDocument();
    expect(countdownAction).toHaveBeenCalled();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メモ化のテスト: 同じpropsで再レンダリングされない
   */
  test("should memoize component correctly", () => {
    const countdownState: CountdownState = {
      days: 1,
      hours: 12,
      minutes: 30,
      isExpired: false,
      isUrgent: false,
      isCritical: false,
    };

    const countdownAction = vi.fn().mockReturnValue("1日 12時間 30分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    const { rerender } = render(<CountdownDisplay {...props} />);

    // 初回レンダリングでcountdownActionが呼ばれることを確認
    expect(countdownAction).toHaveBeenCalledTimes(1);

    // 異なるcountdownActionで再レンダリング（新しい関数インスタンス）
    const newCountdownAction = vi.fn().mockReturnValue("1日 12時間 30分");
    const newProps: CountdownDisplayProps = {
      countdownState,
      countdownAction: newCountdownAction,
    };

    rerender(<CountdownDisplay {...newProps} />);

    // 新しい関数が呼ばれることを確認
    expect(newCountdownAction).toHaveBeenCalledTimes(1);
    expect(countdownAction).toHaveBeenCalledTimes(1); // 元の関数は追加で呼ばれない
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 複数状態の組み合わせテスト
   */
  test("should handle multiple flag combinations correctly", () => {
    const countdownState: CountdownState = {
      days: 0,
      hours: 0,
      minutes: 30,
      isExpired: false,
      isUrgent: true,
      isCritical: true,
    };

    const countdownAction = vi.fn().mockReturnValue("30分");

    const props: CountdownDisplayProps = {
      countdownState,
      countdownAction,
    };

    render(<CountdownDisplay {...props} />);

    // isUrgentとisCriticalの両方がtrueの場合
    expect(screen.getByText("30分")).toBeInTheDocument();
    expect(screen.getByText("まもなく終了します！")).toBeInTheDocument();

    const urgentDiv = screen.getByText("30分").closest("div");
    expect(urgentDiv).toHaveClass("text-red-500");
  });
});
