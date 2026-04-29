import type {
  ReviewSearchParams,
  ReviewSearchResult,
  SearchSuggestion,
} from "@/components/review-search/review-search";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllReviews } from "./cache-get-all-review";
import { getCachedMyReviews } from "./cache-get-my-review";
import { getCachedSearchSuggestions } from "./cache-get-search-suggestion";
import { getCachedUserReviews } from "./cache-get-user-reviews";
import { getAllReviews, getMyReviews, getSearchSuggestions, getUserReviews, updateReview } from "./review-search";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// キャッシュ関数のモック
vi.mock("./cache-get-search-suggestion", () => ({
  getCachedSearchSuggestions: vi.fn(),
}));

vi.mock("./cache-get-all-review", () => ({
  getCachedAllReviews: vi.fn(),
}));

vi.mock("./cache-get-user-reviews", () => ({
  getCachedUserReviews: vi.fn(),
}));

vi.mock("./cache-get-my-review", () => ({
  getCachedMyReviews: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const mockGetAuthenticatedSessionUserId = vi.mocked(getAuthenticatedSessionUserId);
const mockGetCachedSearchSuggestions = vi.mocked(getCachedSearchSuggestions);
const mockGetCachedAllReviews = vi.mocked(getCachedAllReviews);
const mockGetCachedUserReviews = vi.mocked(getCachedUserReviews);
const mockGetCachedMyReviews = vi.mocked(getCachedMyReviews);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("review-search", () => {
  // テスト用のデータを準備
  const testUserId = "test-user-id";
  const testReviewId = "test-review-id";
  const testReview = auctionReviewFactory.build({
    id: testReviewId,
    reviewerId: testUserId,
    rating: 4,
    comment: "テストコメント",
  });

  const testSearchParams: ReviewSearchParams = {
    q: "テスト",
    page: 1,
    tab: "search",
  };

  const testSearchSuggestions: SearchSuggestion[] = [
    { value: "suggestion1", label: "サジェスト1" },
    { value: "suggestion2", label: "サジェスト2" },
  ];

  const mockSearchSuggestionsResult = {
    success: true,
    message: "検索サジェストを取得しました",
    data: testSearchSuggestions,
  };

  const mockReviewSearchResult: ReviewSearchResult = {
    reviews: [
      {
        id: testReviewId,
        rating: 4,
        comment: "テストコメント",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        reviewPosition: "BUYER_TO_SELLER",
        reviewer: {
          id: testUserId,
          username: "テストユーザー",
        },
        reviewee: {
          id: "reviewee-id",
          username: "被評価者",
        },
        auction: {
          id: "auction-id",
          task: {
            id: "task-id",
            task: "テストタスク",
            category: "DEVELOPMENT",
            group: {
              id: "group-id",
              name: "テストグループ",
            },
          },
        },
      },
    ],
    totalCount: 1,
    totalPages: 1,
  };

  const mockReviewSearchResultWithPromise = {
    success: true,
    message: "レビューを取得しました",
    data: mockReviewSearchResult,
  };

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テストヘルパー関数
   */

  // updateReviewの共通テストセットアップヘルパー
  const setupUpdateReviewMocks = (rating: number, comment: string | null, shouldSucceed = true) => {
    mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
    if (shouldSucceed) {
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReview = auctionReviewFactory.build({
        id: testReviewId,
        reviewerId: testUserId,
        rating,
        comment,
        updatedAt: new Date(),
      });
      prismaMock.auctionReview.update.mockResolvedValue(updatedReview);
      return { success: true, message: "レビューを更新しました", data: updatedReview };
    } else {
      prismaMock.auctionReview.findFirst.mockResolvedValue(null);
      return null;
    }
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getSearchSuggestions", () => {
    test.each([
      {
        query: "テスト",
        mockReturn: mockSearchSuggestionsResult,
        expected: mockSearchSuggestionsResult,
      },
      {
        query: "",
        mockReturn: { success: false, message: "検索クエリが空文字列または2文字未満です", data: [] },
        expected: { success: false, message: "検索クエリが空文字列または2文字未満です", data: [] },
      },
      {
        query: null as unknown as string,
        mockReturn: { success: false, message: "検索クエリが空文字列または2文字未満です", data: [] },
        expected: { success: false, message: "検索クエリが空文字列または2文字未満です", data: [] },
      },
      {
        query: undefined as unknown as string,
        mockReturn: { success: false, message: "検索クエリが空文字列または2文字未満です", data: [] },
        expected: { success: false, message: "検索クエリが空文字列または2文字未満です", data: [] },
      },
    ])("should return search suggestions for various query types", async ({ query, mockReturn, expected }) => {
      mockGetCachedSearchSuggestions.mockResolvedValue(mockReturn);

      const result = await getSearchSuggestions(query);

      expect(result).toStrictEqual(expected);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith(query);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });

    test("should throw error when getCachedSearchSuggestions fails", async () => {
      const errorMessage = "サジェスト取得エラー";
      mockGetCachedSearchSuggestions.mockRejectedValue(new Error(errorMessage));

      await expect(getSearchSuggestions("テスト")).rejects.toThrow(errorMessage);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith("テスト");
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getAllReviews", () => {
    test.each([
      { searchParams: testSearchParams, expected: mockReviewSearchResultWithPromise },
      { searchParams: null, expected: mockReviewSearchResultWithPromise },
      { searchParams: { q: "", page: 1 }, expected: mockReviewSearchResultWithPromise },
    ])("should return all reviews for various search params", async ({ searchParams, expected }) => {
      const mockResult = { ...expected };
      mockGetCachedAllReviews.mockResolvedValue(mockResult);

      const result = await getAllReviews(searchParams as ReviewSearchParams);

      expect(result).toStrictEqual(mockResult);
      expect(mockGetCachedAllReviews).toHaveBeenCalledWith(searchParams);
      expect(mockGetCachedAllReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when getCachedAllReviews fails", async () => {
      const errorMessage = "レビュー取得エラー";
      mockGetCachedAllReviews.mockRejectedValue(new Error(errorMessage));

      await expect(getAllReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetCachedAllReviews).toHaveBeenCalledWith(testSearchParams);
      expect(mockGetCachedAllReviews).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserReviews", () => {
    test.each([
      { searchParams: testSearchParams, expected: mockReviewSearchResultWithPromise },
      { searchParams: null, expected: mockReviewSearchResultWithPromise },
      { searchParams: { q: "", page: 1 }, expected: mockReviewSearchResultWithPromise },
    ])("should return user reviews for various search params", async ({ searchParams, expected }) => {
      const mockResult = { ...expected };
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedUserReviews.mockResolvedValue(mockResult);

      const result = await getUserReviews(searchParams as ReviewSearchParams);

      expect(result).toStrictEqual(mockResult);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).toHaveBeenCalledWith(searchParams, testUserId);
      expect(mockGetCachedUserReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when getCachedUserReviews fails", async () => {
      const errorMessage = "ユーザーレビュー取得エラー";
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedUserReviews.mockRejectedValue(new Error(errorMessage));

      await expect(getUserReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).toHaveBeenCalledWith(testSearchParams, testUserId);
      expect(mockGetCachedUserReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when authentication fails", async () => {
      const errorMessage = "認証エラー";
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

      await expect(getUserReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getMyReviews", () => {
    test.each([
      { searchParams: testSearchParams, expected: mockReviewSearchResultWithPromise },
      { searchParams: null, expected: mockReviewSearchResultWithPromise },
      { searchParams: { q: "", page: 1 }, expected: mockReviewSearchResultWithPromise },
    ])("should return my reviews for various search params", async ({ searchParams, expected }) => {
      const mockResult = { ...expected };
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedMyReviews.mockResolvedValue(mockResult);

      const result = await getMyReviews(searchParams as ReviewSearchParams);

      expect(result).toStrictEqual(mockResult);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).toHaveBeenCalledWith(searchParams, testUserId);
      expect(mockGetCachedMyReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when getCachedMyReviews fails", async () => {
      const errorMessage = "マイレビュー取得エラー";
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedMyReviews.mockRejectedValue(new Error(errorMessage));

      await expect(getMyReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).toHaveBeenCalledWith(testSearchParams, testUserId);
      expect(mockGetCachedMyReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when authentication fails", async () => {
      const errorMessage = "認証エラー";
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

      await expect(getMyReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateReview", () => {
    const newRating = 5;
    const newComment = "更新されたコメント";

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("正常系", () => {
      test.each([{ comment: newComment }, { comment: null }, { comment: "" }])(
        "should update review successfully with various comment types",
        async ({ comment }) => {
          const expectedReview = setupUpdateReviewMocks(newRating, comment);

          const result = await updateReview(testReviewId, newRating, comment, testSearchParams);

          expect(result).toStrictEqual(expectedReview);
          expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
          expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
            where: { id: testReviewId, reviewerId: testUserId },
          });
          expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
            where: { id: testReviewId },
            data: {
              rating: newRating,
              comment,
              updatedAt: expect.any(Date) as unknown as Date,
            },
          });
        },
      );

      test.each([{ rating: 1 }, { rating: 5 }, { rating: 0 }])(
        "should handle various rating boundary values",
        async ({ rating }) => {
          const expectedReview = setupUpdateReviewMocks(rating, newComment);

          const result = await updateReview(testReviewId, rating, newComment, testSearchParams);

          expect(result).toStrictEqual(expectedReview);
          expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
            where: { id: testReviewId },
            data: {
              rating,
              comment: newComment,
              updatedAt: expect.any(Date) as unknown as Date,
            },
          });
        },
      );
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    describe("異常系", () => {
      test.each([
        { reviewId: "", rating: 1, comment: newComment, description: "empty reviewId" },
        { reviewId: undefined as unknown as string, rating: 1, comment: newComment, description: "undefined reviewId" },
        { reviewId: null as unknown as string, rating: 1, comment: newComment, description: "null reviewId" },
        { reviewId: testReviewId, rating: -1, comment: newComment, description: "negative rating" },
        { reviewId: testReviewId, rating: 6, comment: newComment, description: "rating above 5" },
        {
          reviewId: testReviewId,
          rating: undefined as unknown as number,
          comment: newComment,
          description: "undefined rating",
        },
        { reviewId: testReviewId, rating: null as unknown as number, comment: newComment, description: "null rating" },
      ])("should handle invalid parameters: $description", async ({ reviewId, rating, comment }) => {
        await expect(updateReview(reviewId, rating, comment, testSearchParams)).rejects.toThrow(
          "無効なパラメータが指定されました",
        );
        expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
      });

      test.each([
        {
          name: "review not found",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
            prismaMock.auctionReview.findFirst.mockResolvedValue(null);
          },
          expectedError: "レビューが見つからないか、編集権限がありません",
        },
        {
          name: "user not authorized",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue("other-user-id");
            prismaMock.auctionReview.findFirst.mockResolvedValue(null);
          },
          expectedError: "レビューが見つからないか、編集権限がありません",
        },
        {
          name: "authentication fails",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error("認証エラー"));
          },
          expectedError: "認証エラー",
        },
        {
          name: "database findFirst fails",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
            prismaMock.auctionReview.findFirst.mockRejectedValue(new Error("データベースエラー"));
          },
          expectedError: "データベースエラー",
        },
        {
          name: "database update fails",
          setup: () => {
            mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
            prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
            prismaMock.auctionReview.update.mockRejectedValue(new Error("更新エラー"));
          },
          expectedError: "更新エラー",
        },
      ])("should handle various error scenarios", async ({ setup, expectedError }) => {
        setup();

        await expect(updateReview(testReviewId, newRating, newComment, testSearchParams)).rejects.toThrow(
          expectedError,
        );
      });
    });
  });
});
