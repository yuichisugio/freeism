import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { BidStatus, TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserBidHistoriesWithCount } from "./bid-auction";

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

describe("bid-auction", () => {
  describe("getUserBidHistoriesWithCount", () => {
    test("should return bid histories with count successfully", async () => {
      // Arrange
      const mockBidHistories = [
        {
          auctionId: "auction-1",
          status: BidStatus.BIDDING,
          auction: {
            currentHighestBid: 1000,
            createdAt: new Date("2024-01-01"),
            endTime: new Date("2024-01-02"),
            task: {
              id: "task-1",
              task: "Test Task 1",
              status: TaskStatus.AUCTION_ACTIVE,
            },
          },
        },
      ];
      const mockDistinctBids = [{ auctionId: "auction-1" }, { auctionId: "auction-2" }];

      // Promise.allの結果をモック

      prismaMock.bidHistory.findMany.mockResolvedValueOnce(mockBidHistories as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      prismaMock.bidHistory.findMany.mockResolvedValueOnce(mockDistinctBids as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistoriesWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(2);
      expect(result.data[0]).toStrictEqual({
        auctionId: "auction-1",
        bidStatus: BidStatus.BIDDING,
        lastBidAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Task 1",
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        currentHighestBid: 1000,
        auctionEndTime: new Date("2024-01-02"),
      });

      expect(prismaMock.bidHistory.findMany).toHaveBeenCalledTimes(2);
    });

    test("should return empty data and zero count when no bid histories", async () => {
      // Arrange

      prismaMock.bidHistory.findMany.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      prismaMock.bidHistory.findMany.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof prismaMock.bidHistory.findMany>>);

      // Act
      const result = await getUserBidHistoriesWithCount(testPage, testUserId, testItemPerPage);

      // Assert
      expect(result.data).toStrictEqual([]);
      expect(result.count).toBe(0);
    });
  });
});
