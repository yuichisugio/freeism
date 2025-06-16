import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserWonAuctionsWithCount } from "./won-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const testUserId = "test-user-id";
const testPage = 1;
const testItemPerPage = 10;

beforeEach(() => {
  // コンソールログをモック化（テスト出力をクリーンに保つ）
  vi.spyOn(console, "log").mockImplementation(() => {
    // テスト中のコンソール出力を抑制
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("won-auction", () => {
  describe("getUserWonAuctionsWithCount", () => {
    test("should return won auctions with count successfully", async () => {
      // Arrange
      const mockWonAuctions = [
        {
          id: "auction-1",
          endTime: new Date("2024-01-02"),
          currentHighestBid: 1500,
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Won Task 1",
            status: TaskStatus.AUCTION_ENDED,
            deliveryMethod: "online",
          },
          reviews: [{ rating: 4 }],
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockWonAuctions as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(3);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(3);
      expect(result.data[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 1500,
        auctionEndTime: new Date("2024-01-02"),
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Won Task 1",
        taskStatus: TaskStatus.AUCTION_ENDED,
        deliveryMethod: "online",
        rating: 4,
      });
    });

    test("should handle wonStatus filter in count", async () => {
      // Arrange

      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(2);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage, "completed");

      // Assert
      expect(result.count).toBe(2);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: {
            status: {
              in: [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
            },
          },
        },
      });
    });

    test("should handle incomplete wonStatus filter", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(3);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage, "incomplete");

      // Assert
      expect(result.count).toBe(3);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: {
            status: {
              in: [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE],
            },
          },
        },
      });
    });

    test("should handle default wonStatus (no filter)", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(4);

      // Act
      const result = await getUserWonAuctionsWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.count).toBe(4);
      expect(prismaMock.auction.count).toHaveBeenCalledWith({
        where: {
          winnerId: testUserId,
          task: {
            status: {
              in: [
                TaskStatus.AUCTION_ENDED,
                TaskStatus.SUPPLIER_DONE,
                TaskStatus.POINTS_DEPOSITED,
                TaskStatus.TASK_COMPLETED,
                TaskStatus.FIXED_EVALUATED,
                TaskStatus.POINTS_AWARDED,
              ],
            },
          },
        },
      });
    });
  });
});
