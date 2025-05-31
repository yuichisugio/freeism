import { type prisma } from "@/lib/prisma";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { auctionReviewFactory, userFactory, userSettingsFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { ReviewPosition } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedDisplayUserInfo } from "./cache-auction-rating";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// next/cacheのモック
vi.mock("next/cache", () => ({
  unstable_cacheTag: vi.fn(),
  unstable_cacheLife: vi.fn(),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getCachedDisplayUserInfo関数のテスト
 */
describe("getCachedDisplayUserInfo", () => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テスト前の初期化
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 正常系テスト
   */
  describe("正常系", () => {
    describe("SELLER_TO_BUYER position", () => {
      it("should return display user info for winner with reviews", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
        const winnerId = "winner-user-id";

        const mockWinner = userFactory.build({
          id: winnerId,
          image: "https://example.com/winner.jpg",
        });

        const mockUserSettings = userSettingsFactory.build({
          userId: winnerId,
          username: "落札者ユーザー",
        });

        const mockReviews = [
          auctionReviewFactory.build({
            revieweeId: winnerId,
            rating: 5,
            auctionId: "other-auction-1",
          }),
          auctionReviewFactory.build({
            revieweeId: winnerId,
            rating: 4,
            auctionId: "other-auction-2",
          }),
        ];

        const mockReviewsForThisAuction = [
          auctionReviewFactory.build({
            auctionId,
            revieweeId: winnerId,
            reviewPosition,
            comment: "素晴らしい落札者でした",
          }),
        ];

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          winner: {
            id: winnerId,
            image: mockWinner.image,
            settings: { username: mockUserSettings.username },
          },
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce(mockReviewsForThisAuction);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId: winnerId,
          appUserName: "落札者ユーザー",
          userImage: "https://example.com/winner.jpg",
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 4, // (5 + 4) / 2 = 4.5 → 4（小数点以下切り捨て）
          ratingCount: 2,
          hasReviewed: true,
          auctionId,
          reviewComment: "素晴らしい落札者でした",
        });

        expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
          where: { id: auctionId },
          select: {
            id: true,
            winner: {
              select: {
                id: true,
                image: true,
                settings: { select: { username: true } },
              },
            },
          },
        });
      });

      it("should return display user info for winner without username", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
        const winnerId = "winner-user-id";

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          winner: {
            id: winnerId,
            image: null,
            settings: null,
          },
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId: winnerId,
          appUserName: "未設定",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should return empty array when no winner exists", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          winner: null,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual([]);
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      });
    });

    describe("BUYER_TO_SELLER position", () => {
      it("should return display user info for creator, reporter, and executor", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
        const creatorId = "creator-user-id";
        const reporterId = "reporter-user-id";
        const executorId = "executor-user-id";

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: {
            id: "task-id",
            creator: {
              id: creatorId,
              image: "https://example.com/creator.jpg",
              settings: { username: "作成者" },
            },
            reporters: [
              {
                user: {
                  id: reporterId,
                  image: "https://example.com/reporter.jpg",
                  settings: { username: "報告者" },
                },
              },
            ],
            executors: [
              {
                user: {
                  id: executorId,
                  image: null,
                  settings: { username: "実行者" },
                },
              },
            ],
          },
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        const mockReviews = [
          auctionReviewFactory.build({
            revieweeId: creatorId,
            rating: 5,
            auctionId: "other-auction-1",
          }),
          auctionReviewFactory.build({
            revieweeId: reporterId,
            rating: 4,
            auctionId: "other-auction-2",
          }),
          auctionReviewFactory.build({
            revieweeId: executorId,
            rating: 3,
            auctionId: "other-auction-3",
          }),
        ];

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(3);

        const creatorResult = result.find((r) => r.userId === creatorId);
        expect(creatorResult).toStrictEqual({
          userId: creatorId,
          appUserName: "作成者",
          userImage: "https://example.com/creator.jpg",
          creatorId,
          reporterId: null,
          executorId: null,
          rating: 5.0,
          ratingCount: 1,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });

        const reporterResult = result.find((r) => r.userId === reporterId);
        expect(reporterResult).toStrictEqual({
          userId: reporterId,
          appUserName: "報告者",
          userImage: "https://example.com/reporter.jpg",
          creatorId: null,
          reporterId,
          executorId: null,
          rating: 4.0,
          ratingCount: 1,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });

        const executorResult = result.find((r) => r.userId === executorId);
        expect(executorResult).toStrictEqual({
          userId: executorId,
          appUserName: "実行者",
          userImage: null,
          creatorId: null,
          reporterId: null,
          executorId,
          rating: 3.0,
          ratingCount: 1,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should handle user with multiple roles", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
        const userId = "multi-role-user-id";

        // Prismaのモック設定（同じユーザーがcreatorとreporterの両方）
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: {
            id: "task-id",
            creator: {
              id: userId,
              image: "https://example.com/user.jpg",
              settings: { username: "マルチロールユーザー" },
            },
            reporters: [
              {
                user: {
                  id: userId,
                  image: "https://example.com/user.jpg",
                  settings: { username: "マルチロールユーザー" },
                },
              },
            ],
            executors: [],
          },
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId,
          appUserName: "マルチロールユーザー",
          userImage: "https://example.com/user.jpg",
          creatorId: userId,
          reporterId: userId,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should handle null users in reporters and executors", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
        const creatorId = "creator-user-id";

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: {
            id: "task-id",
            creator: {
              id: creatorId,
              image: null,
              settings: { username: "作成者のみ" },
            },
            reporters: [{ user: null }],
            executors: [{ user: null }],
          },
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toStrictEqual({
          userId: creatorId,
          appUserName: "作成者のみ",
          userImage: null,
          creatorId,
          reporterId: null,
          executorId: null,
          rating: 0,
          ratingCount: 0,
          hasReviewed: false,
          auctionId,
          reviewComment: null,
        });
      });

      it("should return empty array when no task exists", async () => {
        // Arrange
        const auctionId = "test-auction-id";
        const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

        // Prismaのモック設定
        vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
          id: auctionId,
          task: null,
        } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

        // Act
        const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

        // Assert
        expect(result).toStrictEqual([]);
        expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
      });
    });

    it("should calculate rating correctly with decimal precision", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      const mockReviews = [
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 4,
          auctionId: "other-auction-1",
        }),
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 5,
          auctionId: "other-auction-2",
        }),
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 4,
          auctionId: "other-auction-3",
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(4.0); // (4 + 5 + 4) / 3 = 4.333... → Math.floor(4.333...) = 4（小数点以下切り捨て）
      expect(result[0].ratingCount).toBe(3);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 境界値テスト
   */
  describe("境界値テスト", () => {
    it("should throw error for invalid auctionId or reviewPosition", async () => {
      // Arrange & Act & Assert
      // 空文字列のauctionId
      await expect(getCachedDisplayUserInfo("", ReviewPosition.SELLER_TO_BUYER)).rejects.toThrow("Invalid auctionId or reviewPosition");

      // nullのreviewPosition
      await expect(getCachedDisplayUserInfo("test-auction-id", null as unknown as ReviewPosition)).rejects.toThrow(
        "Invalid auctionId or reviewPosition",
      );

      // undefinedのauctionId
      await expect(getCachedDisplayUserInfo(undefined as unknown as string, ReviewPosition.SELLER_TO_BUYER)).rejects.toThrow(
        "Invalid auctionId or reviewPosition",
      );

      // Prismaが呼ばれていないことを確認
      expect(vi.mocked(prismaMock.auction.findUnique)).not.toHaveBeenCalled();
    });

    it("should handle very long auctionId", async () => {
      // Arrange
      const auctionId = "a".repeat(1000);
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(null);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
    });

    it("should handle rating calculation with various scenarios", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // 単一レビューのテスト
      const singleReview = [
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 3,
          auctionId: "other-auction-1",
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(singleReview).mockResolvedValueOnce([]);

      // Act
      let result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert - 単一レビューの場合
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(3.0);
      expect(result[0].ratingCount).toBe(1);

      // 小数点結果のテスト
      const decimalReviews = [
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 4,
          auctionId: "other-auction-1",
        }),
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 5,
          auctionId: "other-auction-2",
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(decimalReviews).mockResolvedValueOnce([]);

      // Act
      result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert - 小数点以下切り捨ての場合
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(4); // (4 + 5) / 2 = 4.5 → 4（小数点以下切り捨て）
      expect(result[0].ratingCount).toBe(2);
    });

    it("should return empty array when userIds is empty after processing", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Prismaのモック設定 - taskは存在するがcreator, reporters, executorsが全て空
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        task: {
          id: "task-id",
          creator: null,
          reporters: [],
          executors: [],
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
      expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
    });

    it("should handle null and undefined values in user data", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // nullコメントのテスト
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      const mockReviewsForThisAuction = [
        auctionReviewFactory.build({
          auctionId,
          revieweeId: winnerId,
          reviewPosition,
          comment: null, // nullコメントをテスト
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce(mockReviewsForThisAuction);

      // Act
      let result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].reviewComment).toBe(null);
      expect(result[0].hasReviewed).toBe(true);

      // user.settingsがnullの場合のテスト
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: undefined, // imageがundefined
          settings: null, // settingsがnull
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].appUserName).toBe("未設定");
      expect(result[0].userImage).toBe(null);
    });

    it("should handle missing rating in ratingMap", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // 他のユーザーのレビューのみ存在し、winnerのレビューは存在しない
      const mockReviews = [
        auctionReviewFactory.build({
          revieweeId: "other-user-id", // 異なるユーザーID
          rating: 5,
          auctionId: "other-auction-1",
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(0); // ratingMap.get(uid) ?? 0 の ?? 0 部分がテストされる
      expect(result[0].ratingCount).toBe(0);
    });

    it("should handle missing reviewComment in reviewCommentMap", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      const mockReviewsForThisAuction = [
        auctionReviewFactory.build({
          auctionId,
          revieweeId: winnerId,
          reviewPosition,
          comment: undefined, // commentがundefined
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce(mockReviewsForThisAuction);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].reviewComment).toBe(null); // r.comment ?? null の ?? null 部分がテストされる
      expect(result[0].hasReviewed).toBe(true);
    });

    it("should return zero rating as integer when no reviews exist", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // レビューが存在しない場合
      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(0); // レビューがない場合は0（小数点がない正数）
      expect(result[0].ratingCount).toBe(0);
      expect(Number.isInteger(result[0].rating)).toBe(true); // 整数かどうかの確認
      expect(result[0].rating).toBeGreaterThanOrEqual(0); // 正数（0以上）かどうかの確認
    });

    it("should return integer rating when average calculation results in whole number", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // 平均が整数になるレビュー（1 + 3 + 5 = 9, 9 / 3 = 3.0）
      const mockReviews = [
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 1,
          auctionId: "other-auction-1",
        }),
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 3,
          auctionId: "other-auction-2",
        }),
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 5,
          auctionId: "other-auction-3",
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(3.0); // (1 + 3 + 5) / 3 = 3.0（小数点がない正数）
      expect(result[0].ratingCount).toBe(3);
      expect(Number.isInteger(result[0].rating)).toBe(true); // 整数かどうかの確認
      expect(result[0].rating).toBeGreaterThanOrEqual(0); // 正数かどうかの確認
    });

    it("should handle null user.settings (line 221 coverage)", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定 - user.settingsがnullの場合
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: null, // settingsがnull
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].appUserName).toBe("未設定"); // (user.settings as { username: string } | null)?.username ?? "未設定" の ?? "未設定" 部分がテストされる
    });

    it("should handle undefined username in user.settings (line 221 coverage)", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定 - user.settings.usernameがundefinedの場合
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: {}, // usernameプロパティが存在しない
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].appUserName).toBe("未設定"); // username ?? "未設定" の ?? "未設定" 部分がテストされる
    });

    it("should handle auction exists but winner is null (SELLER_TO_BUYER)", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      // Prismaのモック設定 - auctionは存在するがwinnerがnull
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: null, // winnerがnull
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
      expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
    });

    it("should handle auction exists but task is null (BUYER_TO_SELLER)", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Prismaのモック設定 - auctionは存在するがtaskがnull
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        task: null, // taskがnull
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
      expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
    });

    it("should handle user.image is undefined", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定 - user.imageがundefined
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: undefined, // imageがundefined
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].userImage).toBe(null); // user.image ?? null の ?? null 部分がテストされる
    });

    it("should handle neither SELLER_TO_BUYER nor BUYER_TO_SELLER position", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = "INVALID_POSITION" as ReviewPosition; // 想定外の値

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
      expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
    });

    it("should handle hasReviewed false case explicitly", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // レビューは存在するが、このオークションでのレビューは存在しない
      const mockReviews = [
        auctionReviewFactory.build({
          revieweeId: winnerId,
          rating: 4,
          auctionId: "other-auction-1",
        }),
      ];

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce(mockReviews).mockResolvedValueOnce([]); // このオークションでのレビューは空

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].hasReviewed).toBe(false); // reviewedSet.has(uid) が false の場合
      expect(result[0].reviewComment).toBe(null);
      expect(result[0].rating).toBe(4.0);
      expect(result[0].ratingCount).toBe(1);
    });

    it("should handle role conditions false cases", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
      const creatorId = "creator-user-id";

      // Prismaのモック設定 - creatorのみ存在（reporter, executorは存在しない）
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        task: {
          id: "task-id",
          creator: {
            id: creatorId,
            image: null,
            settings: { username: "作成者のみ" },
          },
          reporters: [],
          executors: [],
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].creatorId).toBe(creatorId); // roles.has("creator") が true
      expect(result[0].reporterId).toBe(null); // roles.has("reporter") が false
      expect(result[0].executorId).toBe(null); // roles.has("executor") が false
    });

    it("should handle userMap.has(user.id) false case", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;
      const creatorId = "creator-user-id";
      const reporterId = "reporter-user-id";

      // Prismaのモック設定 - 異なるユーザーがcreatorとreporter
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        task: {
          id: "task-id",
          creator: {
            id: creatorId,
            image: null,
            settings: { username: "作成者" },
          },
          reporters: [
            {
              user: {
                id: reporterId,
                image: null,
                settings: { username: "報告者" },
              },
            },
          ],
          executors: [],
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(2);

      const creatorResult = result.find((r) => r.userId === creatorId);
      expect(creatorResult).toBeDefined();
      expect(creatorResult!.creatorId).toBe(creatorId);
      expect(creatorResult!.reporterId).toBe(null);

      const reporterResult = result.find((r) => r.userId === reporterId);
      expect(reporterResult).toBeDefined();
      expect(reporterResult!.creatorId).toBe(null);
      expect(reporterResult!.reporterId).toBe(reporterId);
    });

    it("should handle userReviews.length === 0 case in rating calculation", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // レビューが全く存在しない場合
      vi.mocked(prismaMock.auctionReview.findMany)
        .mockResolvedValueOnce([]) // 空のレビュー配列
        .mockResolvedValueOnce([]);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].rating).toBe(0); // userReviews.length > 0 が false の場合、avg = 0
      expect(result[0].ratingCount).toBe(0);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 異常系テスト
   */
  describe("異常系", () => {
    it("should throw error when auction.findUnique fails", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const expectedError = new Error("Database connection failed");

      // Prismaのモック設定（エラーを投げる）
      vi.mocked(prismaMock.auction.findUnique).mockRejectedValue(expectedError);

      // Act & Assert
      await expect(getCachedDisplayUserInfo(auctionId, reviewPosition)).rejects.toThrow("Database connection failed");

      expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
        where: { id: auctionId },
        select: {
          id: true,
          winner: {
            select: {
              id: true,
              image: true,
              settings: { select: { username: true } },
            },
          },
        },
      });
    });

    it("should throw error when auctionReview.findMany fails for reviews", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";
      const expectedError = new Error("Review query failed");

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockRejectedValue(expectedError);

      // Act & Assert
      await expect(getCachedDisplayUserInfo(auctionId, reviewPosition)).rejects.toThrow("Review query failed");
    });

    it("should throw error when auctionReview.findMany fails for this auction reviews", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";
      const expectedError = new Error("This auction review query failed");

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockRejectedValue(expectedError);

      // Act & Assert
      await expect(getCachedDisplayUserInfo(auctionId, reviewPosition)).rejects.toThrow("This auction review query failed");
    });

    it("should handle null auction result", async () => {
      // Arrange
      const auctionId = "non-existent-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(null);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
      expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
    });

    it("should handle undefined auction result", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      const result = await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(result).toStrictEqual([]);
      expect(vi.mocked(prismaMock.auctionReview.findMany)).not.toHaveBeenCalled();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュ機能のテスト
   */
  describe("キャッシュ機能", () => {
    it("should call cache functions with correct parameters", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      const { unstable_cacheTag, unstable_cacheLife } = await import("next/cache");

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: null,
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(unstable_cacheTag)).toHaveBeenCalledWith(`DisplayUserInfo:${auctionId}:${reviewPosition}`);
      expect(vi.mocked(unstable_cacheLife)).toHaveBeenCalledWith("max");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データベースクエリのテスト
   */
  describe("データベースクエリ", () => {
    it("should call correct queries for SELLER_TO_BUYER position", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: null,
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
        where: { id: auctionId },
        select: {
          id: true,
          winner: {
            select: {
              id: true,
              image: true,
              settings: { select: { username: true } },
            },
          },
        },
      });
    });

    it("should call correct queries for BUYER_TO_SELLER position", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.BUYER_TO_SELLER;

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        task: null,
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(prismaMock.auction.findUnique)).toHaveBeenCalledWith({
        where: { id: auctionId },
        select: {
          id: true,
          task: {
            select: {
              id: true,
              creator: {
                select: {
                  id: true,
                  image: true,
                  settings: { select: { username: true } },
                },
              },
              reporters: {
                select: {
                  user: {
                    select: {
                      id: true,
                      image: true,
                      settings: { select: { username: true } },
                    },
                  },
                },
              },
              executors: {
                select: {
                  user: {
                    select: {
                      id: true,
                      image: true,
                      settings: { select: { username: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it("should call review queries with correct parameters when users exist", async () => {
      // Arrange
      const auctionId = "test-auction-id";
      const reviewPosition = ReviewPosition.SELLER_TO_BUYER;
      const winnerId = "winner-user-id";

      // Prismaのモック設定
      vi.mocked(prismaMock.auction.findUnique).mockResolvedValue({
        id: auctionId,
        winner: {
          id: winnerId,
          image: null,
          settings: { username: "テストユーザー" },
        },
      } as unknown as Awaited<ReturnType<typeof prisma.auction.findUnique>>);

      vi.mocked(prismaMock.auctionReview.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      // Act
      await getCachedDisplayUserInfo(auctionId, reviewPosition);

      // Assert
      expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenCalledTimes(2);

      // 1回目の呼び出し（全レビュー取得）
      expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenNthCalledWith(1, {
        where: { revieweeId: { in: [winnerId] } },
        select: { revieweeId: true, rating: true, auctionId: true },
      });

      // 2回目の呼び出し（このオークションのレビュー取得）
      expect(vi.mocked(prismaMock.auctionReview.findMany)).toHaveBeenNthCalledWith(2, {
        where: { auctionId, revieweeId: { in: [winnerId] }, reviewPosition },
        select: { revieweeId: true, comment: true },
      });
    });
  });
});
