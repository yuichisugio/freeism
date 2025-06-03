import React from "react";
import { mockUseSession } from "@/test/setup/setup";
// テストセットアップのインポート
import { AllTheProviders } from "@/test/setup/tanstack-query-setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// テスト対象のインポート
import { AutoBidForm } from "./auto-bid-form";

// useAutoBidフックのモック
const mockUseAutoBid = {
  autoBidSettings: null as { id: string; maxBidAmount: number; bidIncrement: number; isActive: boolean } | null,
  loading: false,
  error: null as string | null,
  isAutoBidding: false,
  maxBidAmount: 101,
  bidIncrement: 100,
  handleSetupAutoBid: vi.fn(),
  cancelAutoBidding: vi.fn(),
  setMaxBidAmount: vi.fn(),
  setBidIncrement: vi.fn(),
};

vi.mock("@/hooks/auction/bid/use-auto-bid", () => ({
  useAutoBid: vi.fn(() => mockUseAutoBid),
}));

// framer-motionのモック
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => React.createElement("div", { ...props, "data-testid": "motion-div" }, children),
  },
}));

// lucide-reactアイコンのモック
vi.mock("lucide-react", () => ({
  Bot: () => <div data-testid="bot-icon">Bot</div>,
  HelpCircle: () => <div data-testid="help-circle-icon">HelpCircle</div>,
  Info: () => <div data-testid="info-icon">Info</div>,
}));

describe("AutoBidForm", () => {
  // テストデータ
  const defaultProps = {
    auctionId: "test-auction-id",
    currentHighestBid: 100,
    currentHighestBidderId: "other-user-id",
  };

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // デフォルトのセッション状態を設定
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "test-user-id",
          email: "test@example.com",
          name: "Test User",
        },
      },
      status: "authenticated",
    });

    // デフォルトのuseAutoBidの戻り値を設定
    mockUseAutoBid.autoBidSettings = null;
    mockUseAutoBid.loading = false;
    mockUseAutoBid.error = null;
    mockUseAutoBid.isAutoBidding = false;
    mockUseAutoBid.maxBidAmount = 101;
    mockUseAutoBid.bidIncrement = 100;
    mockUseAutoBid.handleSetupAutoBid = vi.fn();
    mockUseAutoBid.cancelAutoBidding = vi.fn();
    mockUseAutoBid.setMaxBidAmount = vi.fn();
    mockUseAutoBid.setBidIncrement = vi.fn();
  });

  describe("基本レンダリング", () => {
    test("should render auto bid form when not auto bidding", () => {
      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札")).toBeInTheDocument();
      expect(
        screen.getByText("あなたの代わりに自動的に入札します。最高入札額より設定上限額が低い場合は、設定は自動的に削除されます。"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("最大入札額")).toBeInTheDocument();
      expect(screen.getByLabelText("入札単位")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "自動入札を設定" })).toBeInTheDocument();
    });

    test("should render auto bid settings when auto bidding is active", () => {
      // Arrange
      mockUseAutoBid.isAutoBidding = true;
      mockUseAutoBid.autoBidSettings = {
        id: "auto-bid-1",
        maxBidAmount: 500,
        bidIncrement: 50,
        isActive: true,
      };

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札設定中")).toBeInTheDocument();
      expect(screen.getByText("上限入札額:")).toBeInTheDocument();
      expect(screen.getByText("￥500")).toBeInTheDocument();
      expect(screen.getByText("入札単位:")).toBeInTheDocument();
      expect(screen.getByText("￥50")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "自動入札を取り消す" })).toBeInTheDocument();
    });
  });

  describe("フォーム操作", () => {
    test("should update max bid amount when input changes", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const maxBidInput = screen.getByLabelText("最大入札額");

      // Act
      fireEvent.change(maxBidInput, { target: { value: "200" } });

      // Assert
      expect(mockUseAutoBid.setMaxBidAmount).toHaveBeenCalledWith(200);
    });

    test("should update bid increment when input changes", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const bidIncrementInput = screen.getByLabelText("入札単位");

      // Act
      fireEvent.change(bidIncrementInput, { target: { value: "150" } });

      // Assert
      expect(mockUseAutoBid.setBidIncrement).toHaveBeenCalledWith(150);
    });

    test("should call handleSetupAutoBid when form is submitted", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const form = screen.getByRole("button", { name: "自動入札を設定" }).closest("form");

      // Act
      if (form) {
        fireEvent.submit(form);
      }

      // Assert
      expect(mockUseAutoBid.handleSetupAutoBid).toHaveBeenCalled();
    });

    test("should call cancelAutoBidding when cancel button is clicked", async () => {
      // Arrange
      mockUseAutoBid.isAutoBidding = true;
      mockUseAutoBid.autoBidSettings = {
        id: "auto-bid-1",
        maxBidAmount: 500,
        bidIncrement: 50,
        isActive: true,
      };

      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const cancelButton = screen.getByRole("button", { name: "自動入札を取り消す" });

      // Act
      fireEvent.click(cancelButton);

      // Assert
      expect(mockUseAutoBid.cancelAutoBidding).toHaveBeenCalled();
    });
  });

  describe("エラー状態", () => {
    test("should display error message when error occurs", () => {
      // Arrange
      mockUseAutoBid.error = "自動入札の設定に失敗しました";

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札の設定に失敗しました")).toBeInTheDocument();
    });

    test("should display validation error when max bid amount is too low", () => {
      // Arrange
      mockUseAutoBid.maxBidAmount = 50; // currentHighestBid(100)より低い値

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("最大入札額は現在の最高入札額より大きい必要があります")).toBeInTheDocument();
    });
  });

  describe("ローディング状態", () => {
    test("should disable button and show loading text when loading", () => {
      // Arrange
      mockUseAutoBid.loading = true;

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const button = screen.getByRole("button", { name: "処理中..." });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    test("should disable cancel button when loading in auto bidding mode", () => {
      // Arrange
      mockUseAutoBid.loading = true;
      mockUseAutoBid.isAutoBidding = true;
      mockUseAutoBid.autoBidSettings = {
        id: "auto-bid-1",
        maxBidAmount: 500,
        bidIncrement: 50,
        isActive: true,
      };

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const cancelButton = screen.getByRole("button", { name: "自動入札を取り消す" });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe("入力値の検証", () => {
    test("should disable submit button when max bid amount is not greater than current highest bid", () => {
      // Arrange
      mockUseAutoBid.maxBidAmount = 100; // currentHighestBidと同じ値

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const submitButton = screen.getByRole("button", { name: "自動入札を設定" });
      expect(submitButton).toBeDisabled();
    });

    test("should set correct min value for max bid amount input", () => {
      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const maxBidInput = screen.getByLabelText("最大入札額");
      expect(maxBidInput).toBe("101"); // currentHighestBid + 1
    });

    test("should set correct min value for bid increment input", () => {
      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const bidIncrementInput = screen.getByLabelText("入札単位");
      expect(bidIncrementInput).toHaveAttribute("min", "1");
    });
  });

  describe("条件分岐テスト", () => {
    test("should render form when isAutoBidding is false", () => {
      // Arrange
      mockUseAutoBid.isAutoBidding = false;
      mockUseAutoBid.autoBidSettings = null;

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札")).toBeInTheDocument();
      expect(screen.queryByText("自動入札設定中")).not.toBeInTheDocument();
    });

    test("should render settings view when isAutoBidding is true and autoBidSettings exists", () => {
      // Arrange
      mockUseAutoBid.isAutoBidding = true;
      mockUseAutoBid.autoBidSettings = {
        id: "auto-bid-1",
        maxBidAmount: 500,
        bidIncrement: 50,
        isActive: true,
      };

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札設定中")).toBeInTheDocument();
      expect(screen.queryByText("最大入札額")).not.toBeInTheDocument(); // フォームの入力フィールドは表示されない
    });
  });

  describe("境界値テスト", () => {
    test("should handle zero current highest bid", () => {
      // Arrange
      const propsWithZeroBid = {
        ...defaultProps,
        currentHighestBid: 0,
      };
      mockUseAutoBid.maxBidAmount = 1; // 0 + 1

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...propsWithZeroBid} />
        </AllTheProviders>,
      );

      // Assert
      const maxBidInput = screen.getByLabelText("最大入札額");
      expect(maxBidInput).toHaveAttribute("min", "1");
      expect(maxBidInput).toHaveAttribute("value", "1");
    });

    test("should handle very large bid amounts", () => {
      // Arrange
      const largeAmount = 999999999;
      mockUseAutoBid.maxBidAmount = largeAmount;

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const maxBidInput = screen.getByLabelText("最大入札額");
      expect(maxBidInput).toHaveAttribute("value", largeAmount.toString());
    });

    test("should handle zero bid increment", () => {
      // Arrange
      mockUseAutoBid.bidIncrement = 0;

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      const bidIncrementInput = screen.getByLabelText("入札単位");
      expect(bidIncrementInput).toHaveAttribute("value", "0");
    });
  });

  describe("異常系テスト", () => {
    test("should handle null currentHighestBidderId", () => {
      // Arrange
      const propsWithNullBidderId = {
        ...defaultProps,
        currentHighestBidderId: null,
      };

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...propsWithNullBidderId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札")).toBeInTheDocument();
    });

    test("should handle empty auctionId", () => {
      // Arrange
      const propsWithEmptyAuctionId = {
        ...defaultProps,
        auctionId: "",
      };

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...propsWithEmptyAuctionId} />
        </AllTheProviders>,
      );

      // Assert
      expect(screen.getByText("自動入札")).toBeInTheDocument();
    });

    test("should handle negative current highest bid", () => {
      // Arrange
      const propsWithNegativeBid = {
        ...defaultProps,
        currentHighestBid: -100,
      };
      mockUseAutoBid.maxBidAmount = -99; // -100 + 1

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...propsWithNegativeBid} />
        </AllTheProviders>,
      );

      // Assert
      const maxBidInput = screen.getByLabelText("最大入札額");
      expect(maxBidInput).toHaveAttribute("min", "-99"); // -100 + 1
    });

    test("should handle null autoBidSettings when isAutoBidding is true", () => {
      // Arrange
      mockUseAutoBid.isAutoBidding = true;
      mockUseAutoBid.autoBidSettings = null;

      // Act
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      // Assert
      // nullの場合はフォーム表示になるはず（条件分岐の確認）
      expect(screen.getByText("自動入札")).toBeInTheDocument();
      expect(screen.queryByText("自動入札設定中")).not.toBeInTheDocument();
    });
  });

  describe("フォーム入力値テスト", () => {
    test("should handle string input for max bid amount", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const maxBidInput = screen.getByLabelText("最大入札額");

      // Act
      fireEvent.change(maxBidInput, { target: { value: "abc" } });

      // Assert - 無効な文字列は0として解釈される
      expect(mockUseAutoBid.setMaxBidAmount).toHaveBeenCalledWith(0);
    });

    test("should handle string input for bid increment", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const bidIncrementInput = screen.getByLabelText("入札単位");

      // Act
      fireEvent.change(bidIncrementInput, { target: { value: "xyz" } });

      // Assert - 無効な文字列は0として解釈される
      expect(mockUseAutoBid.setBidIncrement).toHaveBeenCalledWith(0);
    });

    test("should handle decimal input for max bid amount", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const maxBidInput = screen.getByLabelText("最大入札額");

      // Act
      fireEvent.change(maxBidInput, { target: { value: "123.45" } });

      // Assert
      expect(mockUseAutoBid.setMaxBidAmount).toHaveBeenCalledWith(123.45);
    });

    test("should handle negative input for bid increment", () => {
      // Arrange
      render(
        <AllTheProviders>
          <AutoBidForm {...defaultProps} />
        </AllTheProviders>,
      );

      const bidIncrementInput = screen.getByLabelText("入札単位");

      // Act
      fireEvent.change(bidIncrementInput, { target: { value: "-50" } });

      // Assert
      expect(mockUseAutoBid.setBidIncrement).toHaveBeenCalledWith(-50);
    });
  });
});
