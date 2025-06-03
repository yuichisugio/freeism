import React from "react";
import * as useBidActionsModule from "@/hooks/auction/bid/use-bid-actions";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { BidForm } from "./bid-form";

// モックの設定
const mockClientPlaceBid = vi.fn();

vi.mock("@/hooks/auction/bid/use-bid-actions");

// web-pushモック（テスト環境でのエラーを防ぐため）
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("./auto-bid-form", () => ({
  AutoBidForm: ({ auctionId, currentHighestBid }: { auctionId: string; currentHighestBid: number }) => (
    <div data-testid="auto-bid-form">
      AutoBidForm - {auctionId} - {currentHighestBid}
    </div>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
  },
}));

describe("BidForm", () => {
  const defaultProps = {
    currentHighestBid: 100,
    currentHighestBidderId: "user-123",
    auctionId: "auction-456",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // useBidActionsのモックを設定
    vi.mocked(useBidActionsModule.useBidActions).mockReturnValue({
      clientPlaceBid: mockClientPlaceBid,
      submitting: false,
      error: null,
      warningMessage: null,
    });
  });

  describe("初期状態", () => {
    test("should render bid form correctly", () => {
      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      expect(screen.getByText("入札フォーム")).toBeInTheDocument();
      expect(screen.getByDisplayValue("101")).toBeInTheDocument(); // currentHighestBid + 1
      expect(screen.getByText("入札する")).toBeInTheDocument();
      expect(screen.getByTestId("auto-bid-form")).toBeInTheDocument();
    });

    test("should set initial bid amount to currentHighestBid + 1", () => {
      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      const bidInput = screen.getByDisplayValue("101");
      expect(bidInput).toBeInTheDocument();
      expect(bidInput).toHaveAttribute("min", "101");
    });

    test("should pass correct props to AutoBidForm", () => {
      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      expect(screen.getByTestId("auto-bid-form")).toHaveTextContent("AutoBidForm - auction-456 - 100");
    });
  });

  describe("エラー表示", () => {
    test("should display error message when error exists", () => {
      // Arrange
      vi.mocked(useBidActionsModule.useBidActions).mockReturnValue({
        clientPlaceBid: mockClientPlaceBid,
        submitting: false,
        error: "入札に失敗しました",
        warningMessage: null,
      });

      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      expect(screen.getByText("入札に失敗しました")).toBeInTheDocument();
    });

    test("should not display error message when no error", () => {
      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      expect(screen.queryByText("入札に失敗しました")).not.toBeInTheDocument();
    });
  });

  describe("サブミット状態", () => {
    test("should disable submit button when submitting", () => {
      // Arrange
      vi.mocked(useBidActionsModule.useBidActions).mockReturnValue({
        clientPlaceBid: mockClientPlaceBid,
        submitting: true,
        error: null,
        warningMessage: null,
      });

      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      const submitButton = screen.getByRole("button", { name: /入札処理中/ });
      expect(submitButton).toBeDisabled();
    });

    test("should enable submit button when not submitting", () => {
      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      const submitButton = screen.getByRole("button", { name: /入札する/ });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("プロップスの変化に対する反応", () => {
    test("should update bid amount when currentHighestBid changes", () => {
      // Arrange
      const { rerender } = render(<BidForm {...defaultProps} />);

      // Act - プロップスを変更
      rerender(<BidForm {...defaultProps} currentHighestBid={200} />);

      // Assert - 新しい最低額に更新される
      expect(screen.getByDisplayValue("201")).toBeInTheDocument();
    });
  });

  describe("入力フィールド", () => {
    test("should allow manual input of bid amount", async () => {
      // Arrange
      render(<BidForm {...defaultProps} />);

      // Act
      const bidInput = screen.getByRole("spinbutton");
      fireEvent.change(bidInput, { target: { value: "150" } });

      // Assert
      expect(bidInput).toHaveValue(150);
    });

    test("should have correct minimum attribute", () => {
      // Arrange
      render(<BidForm {...defaultProps} />);

      // Act
      const bidInput = screen.getByRole("spinbutton");

      // Assert
      expect(bidInput).toHaveAttribute("min", "101");
    });

    test("should handle increment button correctly", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BidForm {...defaultProps} />);

      // Act
      const incrementButton = document.querySelector("#increment-bid");
      if (incrementButton) {
        await user.click(incrementButton);
      }

      // Assert
      const bidInput = screen.getByRole("spinbutton");
      expect(bidInput).toHaveValue(102); // 101 + 1
    });

    test("should handle decrement button being disabled at minimum value", () => {
      // Arrange
      render(<BidForm {...defaultProps} />);

      // Act
      const decrementButton = document.querySelector("#decrement-bid");

      // Assert
      expect(decrementButton).toBeDisabled(); // 最小値なので無効化されているべき
    });
  });
});
