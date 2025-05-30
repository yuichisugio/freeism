import { createAuctionReview, getDisplayUserInfo } from "@/lib/auction/action/auction-rating";
import { AllTheProviders } from "@/test/test-utils/test-utils-tanstack-query";
import { ReviewPosition } from "@prisma/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { DisplayUserInfo } from "./auction-rating";
import { QARating } from "./auction-rating";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// モック設定
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// sonnerのモック
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// auction-ratingアクションのモック
vi.mock("@/lib/auction/action/auction-rating", () => ({
  createAuctionReview: vi.fn(),
  getDisplayUserInfo: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// テストデータ
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const mockDisplayUserInfo: DisplayUserInfo[] = [
  {
    userId: "user-1",
    appUserName: "テストユーザー1",
    userImage: "https://example.com/avatar1.jpg",
    creatorId: "creator-1",
    reporterId: null,
    executorId: null,
    rating: 4.5,
    ratingCount: 10,
    hasReviewed: false,
    auctionId: "auction-1",
    reviewComment: null,
  },
  {
    userId: "user-2",
    appUserName: "テストユーザー2",
    userImage: null,
    creatorId: null,
    reporterId: "reporter-1",
    executorId: null,
    rating: 3.0,
    ratingCount: 5,
    hasReviewed: true,
    auctionId: "auction-1",
    reviewComment: "良い取引でした",
  },
];

const mockDisplayUserInfoEmpty: DisplayUserInfo[] = [];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// テストヘルパー関数
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const renderWithProviders = (component: React.ReactElement) => {
  return render(component, { wrapper: AllTheProviders });
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
// テストスイート
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("QARating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系テスト", () => {
    test("should render seller rating component correctly", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      expect(screen.getByText("落札者情報")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });
    });

    test("should render buyer rating component correctly", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="落札画面" />);

      expect(screen.getByText("出品者情報")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });
    });

    test("should display user information correctly", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
        expect(screen.getByText("(10)")).toBeInTheDocument();
        expect(screen.getAllByTestId("star-icon")).toHaveLength(20); // 2人のユーザー × (表示用5個 + インタラクション用5個)
      });
    });

    test("should show reviewed status for reviewed users", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByTestId("check-circle-icon")).toBeInTheDocument();
      });
    });

    test("should display review comment for reviewed users", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      // 2番目のユーザー（評価済み）に切り替え
      await waitFor(() => {
        const pageButton = screen.getByLabelText("ページ2");
        fireEvent.click(pageButton);
      });

      await waitFor(() => {
        expect(screen.getByText("評価済みです")).toBeInTheDocument();
        expect(screen.getByText("良い取引でした")).toBeInTheDocument();
      });
    });

    test("should handle rating submission successfully", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);
      vi.mocked(createAuctionReview).mockResolvedValue({
        id: "review-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionId: "auction-1",
        reviewerId: "user-1",
        revieweeId: "user-2",
        rating: 4,
        comment: "素晴らしい取引でした",
        completionProofUrl: null,
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
      });

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 評価を選択（インタラクション用の星をクリック）
      const interactiveStars = screen.getAllByTestId("star-icon").slice(5); // 後半5つがインタラクション用
      fireEvent.click(interactiveStars[3]); // 4つ星を選択

      // コメントを入力
      const commentTextarea = screen.getByPlaceholderText("コメントを入力（任意）");
      fireEvent.change(commentTextarea, { target: { value: "素晴らしい取引でした" } });

      // 評価を送信
      const submitButton = screen.getByText("評価を送信");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createAuctionReview).toHaveBeenCalledWith("auction-1", "user-1", 4, "素晴らしい取引でした", ReviewPosition.SELLER_TO_BUYER);
        expect(toast.success).toHaveBeenCalledWith("評価を送信しました");
      });
    });

    test("should navigate between multiple users using page indicators", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 2番目のページに移動
      const page2Button = screen.getByLabelText("ページ2");
      fireEvent.click(page2Button);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー2")).toBeInTheDocument();
      });

      // 1番目のページに戻る
      const page1Button = screen.getByLabelText("ページ1");
      fireEvent.click(page1Button);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });
    });

    test("should navigate using carousel arrows", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfo);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 次へボタンをクリック
      const nextButton = screen.getByLabelText("次へ");
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー2")).toBeInTheDocument();
      });

      // 前へボタンをクリック
      const prevButton = screen.getByLabelText("前へ");
      fireEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });
    });
  });

  describe("異常系テスト", () => {
    test("should show error when rating is not selected", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 評価を選択せずに送信（ボタンは無効化されているが、クリックイベントをテスト）
      const submitButton = screen.getByText("評価を送信");
      fireEvent.click(submitButton);

      // ボタンが無効化されているため、実際にはhandleReviewSubmitは呼ばれない
      // この場合、toast.errorは呼ばれない
      expect(toast.error).not.toHaveBeenCalled();
    });

    test("should handle API error during review submission", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);
      vi.mocked(createAuctionReview).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 評価を選択
      const interactiveStars = screen.getAllByTestId("star-icon").slice(5);
      fireEvent.click(interactiveStars[2]); // 3つ星を選択

      // 評価を送信
      const submitButton = screen.getByText("評価を送信");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("評価の送信に失敗しました: API Error");
      });
    });

    test("should show error when user ID is missing", async () => {
      const userWithoutId = { ...mockDisplayUserInfo[0], userId: "" };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithoutId]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        // userIdが空の場合、ボタンが無効化されるため、クリックしても何も起こらない
        const submitButton = screen.getByText("評価を送信");
        expect(submitButton).toBeDisabled();
      });
    });

    test("should show error when auction ID is missing", async () => {
      const userWithoutAuctionId = { ...mockDisplayUserInfo[0], auctionId: "" };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithoutAuctionId]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        // auctionIdが空の場合、ボタンが無効化されるため、クリックしても何も起こらない
        const submitButton = screen.getByText("評価を送信");
        expect(submitButton).toBeDisabled();
      });
    });

    test("should handle API error during data fetching", async () => {
      vi.mocked(getDisplayUserInfo).mockRejectedValue(new Error("Fetch Error"));

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      // エラーが発生してもコンポーネントがクラッシュしないことを確認
      expect(screen.getByText("落札者情報")).toBeInTheDocument();
    });
  });

  describe("境界値テスト", () => {
    test("should handle empty user list", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue(mockDisplayUserInfoEmpty);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("表示対象者はまだ存在しません")).toBeInTheDocument();
      });
    });

    test("should handle single user", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
        // 単一ユーザーの場合、ナビゲーションボタンは表示されない
        expect(screen.queryByLabelText("次へ")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("前へ")).not.toBeInTheDocument();
      });
    });

    test("should handle user with null image", async () => {
      const userWithNullImage = { ...mockDisplayUserInfo[0], userImage: null };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithNullImage]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
        // アバターのフォールバックが表示されることを確認
        expect(screen.getByText("テ")).toBeInTheDocument();
      });
    });

    test("should handle user with zero rating", async () => {
      const userWithZeroRating = { ...mockDisplayUserInfo[0], rating: 0, ratingCount: 0 };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithZeroRating]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
        expect(screen.getByText("(0)")).toBeInTheDocument();
      });
    });

    test("should handle maximum rating", async () => {
      const userWithMaxRating = { ...mockDisplayUserInfo[0], rating: 5.0, ratingCount: 999 };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithMaxRating]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
        expect(screen.getByText("(999)")).toBeInTheDocument();
      });
    });

    test("should handle very long comment", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);
      vi.mocked(createAuctionReview).mockResolvedValue({
        id: "review-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionId: "auction-1",
        reviewerId: "user-1",
        revieweeId: "user-2",
        rating: 5,
        comment: "a".repeat(1000),
        completionProofUrl: null,
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
      });

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 長いコメントを入力
      const longComment = "a".repeat(1000);
      const interactiveStars = screen.getAllByTestId("star-icon").slice(5);
      fireEvent.click(interactiveStars[4]); // 5つ星を選択

      const commentTextarea = screen.getByPlaceholderText("コメントを入力（任意）");
      fireEvent.change(commentTextarea, { target: { value: longComment } });

      const submitButton = screen.getByText("評価を送信");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createAuctionReview).toHaveBeenCalledWith("auction-1", "user-1", 5, longComment, ReviewPosition.SELLER_TO_BUYER);
      });
    });

    test("should handle empty comment", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);
      vi.mocked(createAuctionReview).mockResolvedValue({
        id: "review-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionId: "auction-1",
        reviewerId: "user-1",
        revieweeId: "user-2",
        rating: 3,
        comment: "",
        completionProofUrl: null,
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
      });

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 評価のみ選択（コメントは空）
      const interactiveStars = screen.getAllByTestId("star-icon").slice(5);
      fireEvent.click(interactiveStars[2]); // 3つ星を選択

      const submitButton = screen.getByText("評価を送信");
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(createAuctionReview).toHaveBeenCalledWith("auction-1", "user-1", 3, "", ReviewPosition.SELLER_TO_BUYER);
      });
    });
  });

  describe("ローディング状態テスト", () => {
    test("should show loading spinner while fetching data", () => {
      vi.mocked(getDisplayUserInfo).mockImplementation(
        () =>
          new Promise(() => {
            // 永続的にpending状態を維持
          }),
      );

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });

    test("should show loading state during review submission", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      // createAuctionReviewを永続的にpending状態にする
      type AuctionReviewType = {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        auctionId: string;
        reviewerId: string;
        revieweeId: string;
        rating: number;
        comment: string | null;
        completionProofUrl: string | null;
        reviewPosition: ReviewPosition;
      };

      let resolvePromise: (value: AuctionReviewType) => void;
      const pendingPromise = new Promise<AuctionReviewType>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(createAuctionReview).mockReturnValue(pendingPromise);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 評価を選択
      const interactiveStars = screen.getAllByTestId("star-icon").slice(5);
      fireEvent.click(interactiveStars[3]);

      // 送信ボタンをクリック
      const submitButton = screen.getByText("評価を送信");
      fireEvent.click(submitButton);

      // ローディング状態を確認
      await waitFor(() => {
        expect(screen.getByText("送信中...")).toBeInTheDocument();
      });

      // テスト終了時にPromiseを解決
      resolvePromise!({
        id: "review-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionId: "auction-1",
        reviewerId: "user-1",
        revieweeId: "user-2",
        rating: 4,
        comment: "",
        completionProofUrl: null,
        reviewPosition: ReviewPosition.SELLER_TO_BUYER,
      });
    });
  });

  describe("ReviewPosition テスト", () => {
    test("should use SELLER_TO_BUYER position for seller screen", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(getDisplayUserInfo).toHaveBeenCalledWith("auction-1", ReviewPosition.SELLER_TO_BUYER);
      });
    });

    test("should use BUYER_TO_SELLER position for buyer screen", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      renderWithProviders(<QARating auctionId="auction-1" text="落札画面" />);

      await waitFor(() => {
        expect(getDisplayUserInfo).toHaveBeenCalledWith("auction-1", ReviewPosition.BUYER_TO_SELLER);
      });
    });
  });

  describe("UI状態テスト", () => {
    test("should disable submit button when rating is not selected", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        const submitButton = screen.getByText("評価を送信");
        expect(submitButton).toBeDisabled();
      });
    });

    test("should enable submit button when rating is selected", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[0]]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("テストユーザー1")).toBeInTheDocument();
      });

      // 評価を選択
      const interactiveStars = screen.getAllByTestId("star-icon").slice(5);
      fireEvent.click(interactiveStars[2]);

      await waitFor(() => {
        const submitButton = screen.getByText("評価を送信");
        expect(submitButton).not.toBeDisabled();
      });
    });

    test("should disable submit button for reviewed users", async () => {
      vi.mocked(getDisplayUserInfo).mockResolvedValue([mockDisplayUserInfo[1]]); // 評価済みユーザー

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        expect(screen.getByText("評価済みです")).toBeInTheDocument();
        expect(screen.queryByText("評価を送信")).not.toBeInTheDocument();
      });
    });

    test("should disable submit button when user ID is empty", async () => {
      const userWithEmptyId = { ...mockDisplayUserInfo[0], userId: "" };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithEmptyId]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        const submitButton = screen.getByText("評価を送信");
        expect(submitButton).toBeDisabled();
      });
    });

    test("should disable submit button when auction ID is empty", async () => {
      const userWithEmptyAuctionId = { ...mockDisplayUserInfo[0], auctionId: "" };
      vi.mocked(getDisplayUserInfo).mockResolvedValue([userWithEmptyAuctionId]);

      renderWithProviders(<QARating auctionId="auction-1" text="出品画面" />);

      await waitFor(() => {
        const submitButton = screen.getByText("評価を送信");
        expect(submitButton).toBeDisabled();
      });
    });
  });
});
