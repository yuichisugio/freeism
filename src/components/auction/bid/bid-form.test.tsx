import React from "react";
import * as useBidActionsModule from "@/hooks/auction/bid/use-bid-actions";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { BidForm } from "./bid-form";

// モックの設定
const mockOnSubmit = vi.fn();
const mockSetBidAmount = vi.fn();
const mockIncrementBid = vi.fn();
const mockDecrementBid = vi.fn();

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
      submitting: false,
      error: null,
      warningMessage: null,
      bidAmount: 101,
      minBid: 101,
      setBidAmount: mockSetBidAmount,
      incrementBid: mockIncrementBid,
      decrementBid: mockDecrementBid,
      onSubmit: mockOnSubmit,
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

    test("should call useBidActions with correct parameters", () => {
      // Act
      render(<BidForm {...defaultProps} />);

      // Assert
      expect(useBidActionsModule.useBidActions).toHaveBeenCalledWith("auction-456", 100);
    });
  });

  describe("エラー表示", () => {
    test("should display error message when error exists", () => {
      // Arrange
      vi.mocked(useBidActionsModule.useBidActions).mockReturnValue({
        submitting: false,
        error: "入札に失敗しました",
        warningMessage: null,
        bidAmount: 101,
        minBid: 101,
        setBidAmount: mockSetBidAmount,
        incrementBid: mockIncrementBid,
        decrementBid: mockDecrementBid,
        onSubmit: mockOnSubmit,
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
        submitting: true,
        error: null,
        warningMessage: null,
        bidAmount: 101,
        minBid: 101,
        setBidAmount: mockSetBidAmount,
        incrementBid: mockIncrementBid,
        decrementBid: mockDecrementBid,
        onSubmit: mockOnSubmit,
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

  describe("入力フィールド", () => {
    test("should call setBidAmount when input value changes", async () => {
      // Arrange
      render(<BidForm {...defaultProps} />);

      // Act
      const bidInput = screen.getByRole("spinbutton");
      fireEvent.change(bidInput, { target: { value: "150" } });

      // Assert
      expect(mockSetBidAmount).toHaveBeenCalledWith(150);
    });

    test("should have correct minimum attribute", () => {
      // Arrange
      render(<BidForm {...defaultProps} />);

      // Act
      const bidInput = screen.getByRole("spinbutton");

      // Assert
      expect(bidInput).toHaveAttribute("min", "101");
    });

    test("should call incrementBid when increment button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BidForm {...defaultProps} />);

      // Act
      const incrementButton = document.querySelector("#increment-bid");
      if (incrementButton) {
        await user.click(incrementButton);
      }

      // Assert
      expect(mockIncrementBid).toHaveBeenCalledTimes(1);
    });

    test("should call decrementBid when decrement button is clicked and not disabled", async () => {
      // Arrange
      const user = userEvent.setup();

      // bidAmountがminBidより大きい場合のモック
      vi.mocked(useBidActionsModule.useBidActions).mockReturnValue({
        submitting: false,
        error: null,
        warningMessage: null,
        bidAmount: 102, // minBidより大きい
        minBid: 101,
        setBidAmount: mockSetBidAmount,
        incrementBid: mockIncrementBid,
        decrementBid: mockDecrementBid,
        onSubmit: mockOnSubmit,
      });

      render(<BidForm {...defaultProps} />);

      // Act
      const decrementButton = document.querySelector("#decrement-bid");
      if (decrementButton) {
        await user.click(decrementButton);
      }

      // Assert
      expect(mockDecrementBid).toHaveBeenCalledTimes(1);
    });

    test("should disable decrement button when bidAmount equals minBid", () => {
      // Arrange
      render(<BidForm {...defaultProps} />);

      // Act
      const decrementButton = document.querySelector("#decrement-bid");

      // Assert
      expect(decrementButton).toBeDisabled(); // bidAmount === minBidなので無効化されているべき
    });
  });

  describe("フォームサブミット", () => {
    test("should call onSubmit when form is submitted", async () => {
      // Arrange
      const user = userEvent.setup();
      render(<BidForm {...defaultProps} />);

      // Act
      const form = screen.getByRole("button", { name: /入札する/ }).closest("form");
      if (form) {
        await user.click(screen.getByRole("button", { name: /入札する/ }));
      }

      // Assert
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    test("should disable submit button when bidAmount is less than minBid", () => {
      // Arrange
      vi.mocked(useBidActionsModule.useBidActions).mockReturnValue({
        submitting: false,
        error: null,
        warningMessage: null,
        bidAmount: 100, // minBidより小さい
        minBid: 101,
        setBidAmount: mockSetBidAmount,
        incrementBid: mockIncrementBid,
        decrementBid: mockDecrementBid,
        onSubmit: mockOnSubmit,
      });

      render(<BidForm {...defaultProps} />);

      // Act
      const submitButton = screen.getByRole("button", { name: /入札する/ });

      // Assert
      expect(submitButton).toBeDisabled();
    });
  });
});
