import type { ReviewSearchParams, ReviewSearchResult, SearchSuggestion } from "@/components/review-search/review-search";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getCachedAllReviews, getCachedMyReviews, getCachedSearchSuggestions, getCachedUserReviews } from "./cache-review-search";
import { getAllReviews, getMyReviews, getSearchSuggestions, getUserReviews, updateReview } from "./review-search";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// getAuthenticatedSessionUserIdのモック
vi.mock("@/lib/utils", () => ({
  getAuthenticatedSessionUserId: vi.fn(),
}));

// キャッシュ関数のモック
vi.mock("./cache-review-search", () => ({
  getCachedSearchSuggestions: vi.fn(),
  getCachedAllReviews: vi.fn(),
  getCachedUserReviews: vi.fn(),
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
    searchQuery: "テスト",
    page: 1,
  };

  const testSearchSuggestions: SearchSuggestion[] = [
    { value: "suggestion1", label: "サジェスト1" },
    { value: "suggestion2", label: "サジェスト2" },
  ];

  const testReviewSearchResult: ReviewSearchResult = {
    reviews: [],
    totalCount: 0,
    totalPages: 0,
  };

  beforeEach(() => {
    // 各テスト前にモックをリセット
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getSearchSuggestions", () => {
    test("should return search suggestions successfully", async () => {
      // モックの設定
      mockGetCachedSearchSuggestions.mockResolvedValue(testSearchSuggestions);

      // 関数を実行
      const result = await getSearchSuggestions("テスト");

      // 結果を検証
      expect(result).toStrictEqual(testSearchSuggestions);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith("テスト");
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });

    test("should handle empty query", async () => {
      // モックの設定
      mockGetCachedSearchSuggestions.mockResolvedValue([]);

      // 関数を実行
      const result = await getSearchSuggestions("");

      // 結果を検証
      expect(result).toStrictEqual([]);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith("");
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });

    test("should handle null query", async () => {
      // モックの設定
      mockGetCachedSearchSuggestions.mockResolvedValue([]);

      // 関数を実行
      const result = await getSearchSuggestions(null as unknown as string);

      // 結果を検証
      expect(result).toStrictEqual([]);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith(null);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });

    test("should handle undefined query", async () => {
      // モックの設定
      mockGetCachedSearchSuggestions.mockResolvedValue([]);

      // 関数を実行
      const result = await getSearchSuggestions(undefined as unknown as string);

      // 結果を検証
      expect(result).toStrictEqual([]);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith(undefined);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });

    test("should throw error when getCachedSearchSuggestions fails", async () => {
      // モックの設定
      const errorMessage = "サジェスト取得エラー";
      mockGetCachedSearchSuggestions.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(getSearchSuggestions("テスト")).rejects.toThrow(errorMessage);
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledWith("テスト");
      expect(mockGetCachedSearchSuggestions).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getAllReviews", () => {
    test("should return all reviews successfully with search params", async () => {
      // モックの設定
      mockGetCachedAllReviews.mockResolvedValue(testReviewSearchResult);

      // 関数を実行
      const result = await getAllReviews(testSearchParams);

      // 結果を検証
      expect(result).toStrictEqual(testReviewSearchResult);
      expect(mockGetCachedAllReviews).toHaveBeenCalledWith(testSearchParams);
      expect(mockGetCachedAllReviews).toHaveBeenCalledOnce();
    });

    test("should return all reviews successfully with null search params", async () => {
      // モックの設定
      mockGetCachedAllReviews.mockResolvedValue(testReviewSearchResult);

      // 関数を実行
      const result = await getAllReviews(null);

      // 結果を検証
      expect(result).toStrictEqual(testReviewSearchResult);
      expect(mockGetCachedAllReviews).toHaveBeenCalledWith(null);
      expect(mockGetCachedAllReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when getCachedAllReviews fails", async () => {
      // モックの設定
      const errorMessage = "全レビュー取得エラー";
      mockGetCachedAllReviews.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(getAllReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetCachedAllReviews).toHaveBeenCalledWith(testSearchParams);
      expect(mockGetCachedAllReviews).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getUserReviews", () => {
    test("should return user reviews successfully with search params", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedUserReviews.mockResolvedValue(testReviewSearchResult);

      // 関数を実行
      const result = await getUserReviews(testSearchParams);

      // 結果を検証
      expect(result).toStrictEqual(testReviewSearchResult);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).toHaveBeenCalledWith(testSearchParams, testUserId);
      expect(mockGetCachedUserReviews).toHaveBeenCalledOnce();
    });

    test("should return user reviews successfully with null search params", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedUserReviews.mockResolvedValue(testReviewSearchResult);

      // 関数を実行
      const result = await getUserReviews(null);

      // 結果を検証
      expect(result).toStrictEqual(testReviewSearchResult);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).toHaveBeenCalledWith(null, testUserId);
      expect(mockGetCachedUserReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when getAuthenticatedSessionUserId fails", async () => {
      // モックの設定
      const errorMessage = "認証エラー";
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(getUserReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).not.toHaveBeenCalled();
    });

    test("should throw error when getCachedUserReviews fails", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      const errorMessage = "ユーザーレビュー取得エラー";
      mockGetCachedUserReviews.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(getUserReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedUserReviews).toHaveBeenCalledWith(testSearchParams, testUserId);
      expect(mockGetCachedUserReviews).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("getMyReviews", () => {
    test("should return my reviews successfully with search params", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedMyReviews.mockResolvedValue(testReviewSearchResult);

      // 関数を実行
      const result = await getMyReviews(testSearchParams);

      // 結果を検証
      expect(result).toStrictEqual(testReviewSearchResult);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).toHaveBeenCalledWith(testSearchParams, testUserId);
      expect(mockGetCachedMyReviews).toHaveBeenCalledOnce();
    });

    test("should return my reviews successfully with null search params", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      mockGetCachedMyReviews.mockResolvedValue(testReviewSearchResult);

      // 関数を実行
      const result = await getMyReviews(null);

      // 結果を検証
      expect(result).toStrictEqual(testReviewSearchResult);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).toHaveBeenCalledWith(null, testUserId);
      expect(mockGetCachedMyReviews).toHaveBeenCalledOnce();
    });

    test("should throw error when getAuthenticatedSessionUserId fails", async () => {
      // モックの設定
      const errorMessage = "認証エラー";
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(getMyReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).not.toHaveBeenCalled();
    });

    test("should throw error when getCachedMyReviews fails", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      const errorMessage = "マイレビュー取得エラー";
      mockGetCachedMyReviews.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(getMyReviews(testSearchParams)).rejects.toThrow(errorMessage);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(mockGetCachedMyReviews).toHaveBeenCalledWith(testSearchParams, testUserId);
      expect(mockGetCachedMyReviews).toHaveBeenCalledOnce();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("updateReview", () => {
    const newRating = 5;
    const newComment = "更新されたコメント";
    const updatedReview = auctionReviewFactory.build({
      id: testReviewId,
      reviewerId: testUserId,
      rating: newRating,
      comment: newComment,
      updatedAt: new Date(),
    });

    test("should update review successfully", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      prismaMock.auctionReview.update.mockResolvedValue(updatedReview);

      // 関数を実行
      const result = await updateReview(testReviewId, newRating, newComment);

      // 結果を検証
      expect(result).toStrictEqual(updatedReview);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: testReviewId,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: newRating,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should update review successfully with null comment", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewWithNullComment = { ...updatedReview, comment: null };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewWithNullComment);

      // 関数を実行
      const result = await updateReview(testReviewId, newRating, null);

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewWithNullComment);
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: testReviewId,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: newRating,
          comment: null,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should throw error when review not found", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(null);

      // 関数を実行してエラーを検証
      await expect(updateReview(testReviewId, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: testReviewId,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });

    test("should throw error when user is not the reviewer", async () => {
      // モックの設定
      const otherUserId = "other-user-id";
      mockGetAuthenticatedSessionUserId.mockResolvedValue(otherUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(null);

      // 関数を実行してエラーを検証
      await expect(updateReview(testReviewId, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: testReviewId,
          reviewerId: otherUserId,
        },
      });
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });

    test("should throw error when getAuthenticatedSessionUserId fails", async () => {
      // モックの設定
      const errorMessage = "認証エラー";
      mockGetAuthenticatedSessionUserId.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(updateReview(testReviewId, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });

    test("should throw error when findFirst fails", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      const errorMessage = "データベースエラー";
      prismaMock.auctionReview.findFirst.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(updateReview(testReviewId, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: testReviewId,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });

    test("should throw error when update fails", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const errorMessage = "更新エラー";
      prismaMock.auctionReview.update.mockRejectedValue(new Error(errorMessage));

      // 関数を実行してエラーを検証
      await expect(updateReview(testReviewId, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: testReviewId,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: newRating,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    // 境界値テスト
    test("should handle minimum rating value", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewMinRating = { ...updatedReview, rating: 1 };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewMinRating);

      // 関数を実行
      const result = await updateReview(testReviewId, 1, newComment);

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewMinRating);
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: 1,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should handle maximum rating value", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewMaxRating = { ...updatedReview, rating: 5 };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewMaxRating);

      // 関数を実行
      const result = await updateReview(testReviewId, 5, newComment);

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewMaxRating);
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: 5,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should handle empty comment", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewEmptyComment = { ...updatedReview, comment: "" };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewEmptyComment);

      // 関数を実行
      const result = await updateReview(testReviewId, newRating, "");

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewEmptyComment);
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: newRating,
          comment: "",
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should handle invalid rating value (0)", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewInvalidRating = { ...updatedReview, rating: 0 };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewInvalidRating);

      // 関数を実行
      const result = await updateReview(testReviewId, 0, newComment);

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewInvalidRating);
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: 0,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should handle invalid rating value (6)", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewInvalidRating = { ...updatedReview, rating: 6 };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewInvalidRating);

      // 関数を実行
      const result = await updateReview(testReviewId, 6, newComment);

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewInvalidRating);
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: 6,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should handle negative rating value", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(testReview);
      const updatedReviewNegativeRating = { ...updatedReview, rating: -1 };
      prismaMock.auctionReview.update.mockResolvedValue(updatedReviewNegativeRating);

      // 関数を実行
      const result = await updateReview(testReviewId, -1, newComment);

      // 結果を検証
      expect(result).toStrictEqual(updatedReviewNegativeRating);
      expect(prismaMock.auctionReview.update).toHaveBeenCalledWith({
        where: { id: testReviewId },
        data: {
          rating: -1,
          comment: newComment,
          updatedAt: expect.any(Date) as unknown as Date,
        },
      });
    });

    test("should handle empty reviewId", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(null);

      // 関数を実行してエラーを検証
      await expect(updateReview("", newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: "",
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });

    test("should handle undefined reviewId", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(null);

      // 関数を実行してエラーを検証
      await expect(updateReview(undefined as unknown as string, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: undefined,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });

    test("should handle null reviewId", async () => {
      // モックの設定
      mockGetAuthenticatedSessionUserId.mockResolvedValue(testUserId);
      prismaMock.auctionReview.findFirst.mockResolvedValue(null);

      // 関数を実行してエラーを検証
      await expect(updateReview(null as unknown as string, newRating, newComment)).rejects.toThrow("レビューの更新に失敗しました");
      expect(mockGetAuthenticatedSessionUserId).toHaveBeenCalledOnce();
      expect(prismaMock.auctionReview.findFirst).toHaveBeenCalledWith({
        where: {
          id: null,
          reviewerId: testUserId,
        },
      });
      expect(prismaMock.auctionReview.update).not.toHaveBeenCalled();
    });
  });
});
