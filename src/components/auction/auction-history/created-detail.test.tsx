import type { TaskStatus } from "@prisma/client";
import React from "react";
import { type AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { TaskStatus as TaskStatusEnum } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AuctionCreatedDetail } from "./created-detail";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// ホイストされたモック関数の宣言
const { mockUseCreatedDetail, mockNotFound } = vi.hoisted(() => ({
  mockUseCreatedDetail: vi.fn(),
  mockNotFound: vi.fn(),
}));

// useCreatedDetailフックのモック
vi.mock("@/hooks/auction/history/use-created-detail", () => ({
  useCreatedDetail: mockUseCreatedDetail,
}));

// Loadingコンポーネントのモック
vi.mock("@/components/share/share-loading", () => ({
  Loading: () => <div data-testid="loading">Loading...</div>,
}));

// Errorコンポーネントのモック
vi.mock("@/components/share/share-error", () => ({
  Error: ({ error, previousPageURL }: { error: string; previousPageURL: string }) => (
    <div data-testid="error">
      <span data-testid="error-message">{error}</span>
      <span data-testid="previous-url">{previousPageURL}</span>
    </div>
  ),
}));

// next/navigationのnotFoundをモック
vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

// その他のコンポーネントをモック
vi.mock("@/components/auction/common/auction-qa", () => ({
  AuctionQA: ({ auctionId }: { auctionId: string }) => <div data-testid="auction-qa">AuctionQA: {auctionId}</div>,
}));

vi.mock("../common/auction-rating", () => ({
  QARating: ({ auctionId }: { auctionId: string }) => <div data-testid="qa-rating">QARating: {auctionId}</div>,
}));

vi.mock("../common/status-badge", () => ({
  TaskStatusBadge: ({ status }: { status: TaskStatus }) => <div data-testid="task-status-badge">Status: {status}</div>,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストスイート
 */
describe("AuctionCreatedDetail", () => {
  const testAuctionId = "test-auction-id";

  // テストデータ
  const mockAuctionData: AuctionHistoryCreatedDetail = {
    id: testAuctionId,
    currentHighestBid: 1000,
    startTime: new Date("2024-01-01T10:00:00Z"),
    endTime: new Date("2024-01-02T10:00:00Z"),
    status: TaskStatusEnum.AUCTION_ENDED,
    task: {
      id: "task-id",
      task: "テストタスク",
      detail: "テストタスクの詳細説明",
      imageUrl: "https://example.com/image.jpg",
      status: TaskStatusEnum.AUCTION_ENDED,
      deliveryMethod: "オンライン配信",
      creatorId: "creator-id",
      executors: [{ userId: "executor-id" }],
      reporters: [{ userId: "reporter-id" }],
    },
    winner: {
      id: "winner-id",
      name: "落札者名",
      image: "https://example.com/winner.jpg",
    },
    winnerId: "winner-id",
    bidHistories: [
      {
        id: "bid-1",
        amount: 1000,
        isAutoBid: false,
        createdAt: new Date("2024-01-01T11:00:00Z"),
        user: {
          id: "bidder-id",
          name: "入札者名",
          image: "https://example.com/bidder.jpg",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ローディング状態", () => {
    test("should show loading component when isLoading is true", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: null,
        isLoading: true,
        deliveryMethod: "",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByTestId("loading")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エラー状態", () => {
    test("should show error component when error exists", () => {
      // Arrange
      const errorMessage = "テストエラーメッセージ";
      mockUseCreatedDetail.mockReturnValue({
        auction: null,
        isLoading: false,
        deliveryMethod: "",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: errorMessage,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByTestId("error-message")).toHaveTextContent(errorMessage);
      expect(screen.getByTestId("previous-url")).toHaveTextContent("/dashboard/auction/history?tab=created");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("notFound状態", () => {
    test("should call notFound when auction is null and no loading/error", () => {
      // Arrange
      // notFoundをエラーをスローするようにモック（Next.jsの実際の動作を模倣）
      mockNotFound.mockImplementation(() => {
        throw new Error("Not Found");
      });

      mockUseCreatedDetail.mockReturnValue({
        auction: null,
        isLoading: false,
        deliveryMethod: "",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act & Assert
      expect(() => {
        render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      }).toThrow("Not Found");

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("正常状態", () => {
    test("should render auction details when auction data is available", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("＜出品履歴＞ テストタスク")).toBeInTheDocument();
      expect(screen.getByText("1,000 ポイント")).toBeInTheDocument();
      expect(screen.getByText("テストタスクの詳細説明")).toBeInTheDocument();
    });

    test("should render tabs correctly", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("出品情報")).toBeInTheDocument();
      expect(screen.getByText("入札履歴")).toBeInTheDocument();
      expect(screen.getByText("メッセージ(出品中)")).toBeInTheDocument();
      expect(screen.getByText("メッセージ(落札後)")).toBeInTheDocument();
    });

    test("should render delivery method section", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("提供方法")).toBeInTheDocument();
      expect(screen.getByText("オンライン配信")).toBeInTheDocument();
    });

    test("should show bid histories when available", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "bids",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getAllByText("入札履歴")).toHaveLength(2); // タブとタイトルで2箇所
      expect(screen.getByText("入札者名")).toBeInTheDocument();
      expect(screen.getByText("1,000 ポイント")).toBeInTheDocument();
      expect(screen.getByText("通常入札")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("ユーザーインタラクション", () => {
    test("should call startEditingDelivery when edit button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockStartEditingDelivery = vi.fn();
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: mockStartEditingDelivery,
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      const editButton = screen.getByRole("button", { name: /編集/i });
      await user.click(editButton);

      // Assert
      expect(mockStartEditingDelivery).toHaveBeenCalledOnce();
    });

    test("should show textarea when editing delivery method", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: true,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /更新する/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /キャンセル/i })).toBeInTheDocument();
    });

    test("should call setDeliveryMethod when textarea value changes", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockSetDeliveryMethod = vi.fn();
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "",
        isEditingDelivery: true,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: mockSetDeliveryMethod,
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "新しい配信方法");

      // Assert
      // userEvent.typeは文字を一文字ずつ入力するため、呼び出し回数をチェック
      expect(mockSetDeliveryMethod).toHaveBeenCalledTimes("新しい配信方法".length);
      // 最後の呼び出しが最後の文字（法）になるかをチェック
      expect(mockSetDeliveryMethod).toHaveBeenLastCalledWith("法");
    });

    test("should call handleUpdateDeliveryMethod when save button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockHandleUpdateDeliveryMethod = vi.fn();
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "新しい配信方法",
        isEditingDelivery: true,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: mockHandleUpdateDeliveryMethod,
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      const saveButton = screen.getByRole("button", { name: /更新する/i });
      await user.click(saveButton);

      // Assert
      expect(mockHandleUpdateDeliveryMethod).toHaveBeenCalledWith("新しい配信方法");
    });

    test("should call cancelEditingDelivery when cancel button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockCancelEditingDelivery = vi.fn();
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: true,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: mockCancelEditingDelivery,
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      const cancelButton = screen.getByRole("button", { name: /キャンセル/i });
      await user.click(cancelButton);

      // Assert
      expect(mockCancelEditingDelivery).toHaveBeenCalledOnce();
    });

    test("should call handleComplete when complete button is clicked", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockHandleComplete = vi.fn();
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: mockHandleComplete,
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      const completeButton = screen.getByRole("button", { name: /商品提供を完了する/i });
      await user.click(completeButton);

      // AlertDialogの完了ボタンをクリック
      const confirmButton = screen.getByRole("button", { name: /完了する/i });
      await user.click(confirmButton);

      // Assert
      expect(mockHandleComplete).toHaveBeenCalledOnce();
    });

    test("should show loading state when completing", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: true,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const completeButton = screen.getByRole("button", { name: /処理中.../i });
      expect(completeButton).toBeInTheDocument();
      expect(completeButton).toBeDisabled();
    });

    test("should show loading state when updating delivery method", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: true,
        isUpdatingDelivery: true,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const saveButton = screen.getByRole("button", { name: /更新中.../i });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });

    test("should disable save button when delivery method is empty", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "",
        isEditingDelivery: true,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const saveButton = screen.getByRole("button", { name: /更新する/i });
      expect(saveButton).toBeDisabled();
    });

    test("should call setTab when tab is changed", async () => {
      // Arrange
      const user = userEvent.setup();
      const mockSetTab = vi.fn();
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: mockSetTab,
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);
      const bidHistoryTab = screen.getByRole("tab", { name: /入札履歴/i });
      await user.click(bidHistoryTab);

      // Assert
      expect(mockSetTab).toHaveBeenCalledWith("bids");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("エッジケース・境界値テスト", () => {
    test("should show no bids message when bid histories is empty", () => {
      // Arrange
      const auctionWithNoBids = {
        ...mockAuctionData,
        bidHistories: [],
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNoBids,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "bids",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("まだ入札はありません")).toBeInTheDocument();
    });

    test("should show no winner message when auction has no winner", () => {
      // Arrange
      const auctionWithNoWinner = {
        ...mockAuctionData,
        winner: null,
        winnerId: null,
        task: {
          ...mockAuctionData.task,
          status: TaskStatusEnum.AUCTION_ENDED,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNoWinner,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("落札者はいません")).toBeInTheDocument();
    });

    test("should show auction not ended message when auction is still active", () => {
      // Arrange
      const activeAuction = {
        ...mockAuctionData,
        winner: null,
        winnerId: null,
        task: {
          ...mockAuctionData.task,
          status: TaskStatusEnum.AUCTION_ACTIVE,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: activeAuction,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("オークションはまだ終了していません")).toBeInTheDocument();
    });

    test("should show completed button when task is already completed", () => {
      // Arrange
      const completedAuction = {
        ...mockAuctionData,
        task: {
          ...mockAuctionData.task,
          status: TaskStatusEnum.SUPPLIER_DONE,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: completedAuction,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByRole("button", { name: /完了済み/i })).toBeDisabled();
    });

    test("should not show edit button when task is completed", () => {
      // Arrange
      const completedAuction = {
        ...mockAuctionData,
        task: {
          ...mockAuctionData.task,
          status: TaskStatusEnum.SUPPLIER_DONE,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: completedAuction,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.queryByRole("button", { name: /編集/i })).not.toBeInTheDocument();
    });

    test("should show default message when delivery method is null", () => {
      // Arrange
      const auctionWithNullDelivery = {
        ...mockAuctionData,
        task: {
          ...mockAuctionData.task,
          deliveryMethod: null,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNullDelivery,
        isLoading: false,
        deliveryMethod: "",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("未設定")).toBeInTheDocument();
    });

    test("should show default message when task detail is null", () => {
      // Arrange
      const auctionWithNullDetail = {
        ...mockAuctionData,
        task: {
          ...mockAuctionData.task,
          detail: null,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNullDetail,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("商品詳細はありません")).toBeInTheDocument();
    });

    test("should not render image when imageUrl is null", () => {
      // Arrange
      const auctionWithNullImage = {
        ...mockAuctionData,
        task: {
          ...mockAuctionData.task,
          imageUrl: null,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNullImage,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const image = screen.queryByRole("img", { name: mockAuctionData.task.task });
      expect(image).not.toBeInTheDocument();
    });

    test("should disable tabs when no winner exists", () => {
      // Arrange
      const auctionWithNoWinner = {
        ...mockAuctionData,
        winner: null,
        winnerId: null,
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNoWinner,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const chatBeforeTab = screen.getByRole("tab", { name: /メッセージ\(出品中\)/i });
      const chatAfterTab = screen.getByRole("tab", { name: /メッセージ\(落札後\)/i });
      expect(chatBeforeTab).toHaveAttribute("data-disabled", "");
      expect(chatAfterTab).toHaveAttribute("data-disabled", "");
    });

    test("should display auto bid correctly in bid history", () => {
      // Arrange
      const auctionWithAutoBid = {
        ...mockAuctionData,
        bidHistories: [
          {
            id: "bid-1",
            amount: 1000,
            isAutoBid: true,
            createdAt: new Date("2024-01-01T11:00:00Z"),
            user: {
              id: "bidder-id",
              name: "入札者名",
              image: "https://example.com/bidder.jpg",
            },
          },
        ],
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithAutoBid,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "bids",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      expect(screen.getByText("自動入札")).toBeInTheDocument();
    });

    test("should show winner badge in bid history", () => {
      // Arrange
      // 入札者が落札者と同じIDになるようにテストデータを調整
      const auctionWithWinnerBidHistory = {
        ...mockAuctionData,
        bidHistories: [
          {
            id: "bid-1",
            amount: 1000,
            isAutoBid: false,
            createdAt: new Date("2024-01-01T11:00:00Z"),
            user: {
              id: "winner-id", // 落札者と同じID
              name: "落札者名",
              image: "https://example.com/winner.jpg",
            },
          },
        ],
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithWinnerBidHistory,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "bids",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      // 落札者のバッジは入札者名の隣に表示されます
      const winnerBadge = screen.getByText("落札者");
      expect(winnerBadge).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("異常系・バリデーション", () => {
    test("should disable buttons when task id is null", () => {
      // Arrange
      const auctionWithNullTaskId = {
        ...mockAuctionData,
        task: {
          ...mockAuctionData.task,
          id: null,
        },
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithNullTaskId as unknown as AuctionHistoryCreatedDetail,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const editButton = screen.getByRole("button", { name: /編集/i });
      const completeButton = screen.getByRole("button", { name: /商品提供を完了する/i });
      expect(editButton).toBeDisabled();
      expect(completeButton).toBeDisabled();
    });

    test("should handle user with no name or image in bid history", () => {
      // Arrange
      const auctionWithAnonymousUser = {
        ...mockAuctionData,
        bidHistories: [
          {
            id: "bid-1",
            amount: 1000,
            isAutoBid: false,
            createdAt: new Date("2024-01-01T11:00:00Z"),
            user: {
              id: "bidder-id",
              name: null,
              image: null,
            },
          },
        ],
      };

      mockUseCreatedDetail.mockReturnValue({
        auction: auctionWithAnonymousUser,
        isLoading: false,
        deliveryMethod: "オンライン配信",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "bids",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      // テーブルヘッダーとセル内の両方にテキストが存在するため、getAllByTextを使用
      const bidderTexts = screen.getAllByText("入札者");
      expect(bidderTexts.length).toBeGreaterThan(0);
    });

    test("should handle empty string auctionId", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: null,
        isLoading: false,
        deliveryMethod: "",
        isEditingDelivery: false,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      mockNotFound.mockImplementation(() => {
        throw new Error("Not Found");
      });

      // Act & Assert
      expect(() => {
        render(<AuctionCreatedDetail auctionId="" />);
      }).toThrow("Not Found");
    });

    test("should handle whitespace-only delivery method", () => {
      // Arrange
      mockUseCreatedDetail.mockReturnValue({
        auction: mockAuctionData,
        isLoading: false,
        deliveryMethod: "   ",
        isEditingDelivery: true,
        isUpdatingDelivery: false,
        isCompleting: false,
        tab: "info",
        error: null,
        handleComplete: vi.fn(),
        setDeliveryMethod: vi.fn(),
        handleUpdateDeliveryMethod: vi.fn(),
        cancelEditingDelivery: vi.fn(),
        startEditingDelivery: vi.fn(),
        setTab: vi.fn(),
      });

      // Act
      render(<AuctionCreatedDetail auctionId={testAuctionId} />);

      // Assert
      const saveButton = screen.getByRole("button", { name: /更新する/i });
      expect(saveButton).toBeDisabled();
    });
  });
});
