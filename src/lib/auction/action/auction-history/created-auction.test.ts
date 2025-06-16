import type { AuctionCreatedTabFilter } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserCreatedAuctionsWithCount } from "./created-auction";

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

describe("created-auction", () => {
  describe("getUserCreatedAuctionsWithCount", () => {
    test("should return created auctions with count successfully", async () => {
      // Arrange
      const mockCreatedAuctions = [
        {
          id: "auction-1",
          currentHighestBid: 2000,
          endTime: new Date("2024-01-03"),
          createdAt: new Date("2024-01-01"),
          task: {
            id: "task-1",
            task: "Test Created Task 1",
            status: TaskStatus.AUCTION_ACTIVE,
            deliveryMethod: "online",
            creator: { id: testUserId },
            executors: [{ userId: testUserId }],
            reporters: [{ userId: "reporter-1" }],
          },
          winner: {
            id: "winner-1",
            name: "Winner Name",
          },
        },
      ];

      prismaMock.auction.findMany.mockResolvedValue(mockCreatedAuctions as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(5);

      // Act
      const result = await getUserCreatedAuctionsWithCount(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.count).toBe(5);
      expect(result.data[0]).toStrictEqual({
        auctionId: "auction-1",
        currentHighestBid: 2000,
        auctionEndTime: new Date("2024-01-03"),
        taskStatus: TaskStatus.AUCTION_ACTIVE,
        auctionCreatedAt: new Date("2024-01-01"),
        taskId: "task-1",
        taskName: "Test Created Task 1",
        deliveryMethod: "online",
        winnerId: "winner-1",
        winnerName: "Winner Name",
        isCreator: true,
        isExecutor: true,
        isReporter: false,
        taskRole: ["SUPPLIER", "EXECUTOR"],
      });
    });

    test("should return empty data and zero count when no created auctions", async () => {
      // Arrange
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      const result = await getUserCreatedAuctionsWithCount(testPage, testUserId, testItemPerPage, [], "and");

      // Assert
      expect(result.data).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    test("should handle filter conditions in created auctions", async () => {
      // Arrange
      const filters: AuctionCreatedTabFilter[] = ["ended"];
      prismaMock.auction.findMany.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof prismaMock.auction.findMany>>);
      prismaMock.auction.count.mockResolvedValue(0);

      // Act
      await getUserCreatedAuctionsWithCount(testPage, testUserId, testItemPerPage, filters, "and");

      // Assert
      expect(prismaMock.auction.findMany).toHaveBeenCalledTimes(1);
      const callArgs = prismaMock.auction.findMany.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();

      if (callArgs?.where && "AND" in callArgs.where) {
        const andConditions = callArgs.where.AND as Array<Record<string, unknown>>;
        expect(andConditions).toHaveLength(2);

        // タスクロール条件の確認
        const roleCondition = andConditions.find((condition) => "task" in condition && "OR" in (condition.task as Record<string, unknown>));
        expect(roleCondition).toBeDefined();

        // ステータス条件の確認
        const statusCondition = andConditions.find((condition) => "task" in condition && "status" in (condition.task as Record<string, unknown>));
        expect(statusCondition).toBeDefined();

        if (statusCondition && "task" in statusCondition) {
          const taskCondition = statusCondition.task as Record<string, unknown>;
          if ("status" in taskCondition) {
            const statusObj = taskCondition.status as Record<string, unknown>;
            if ("in" in statusObj) {
              const statusArray = statusObj.in as TaskStatus[];
              expect(statusArray).toContain(TaskStatus.AUCTION_ENDED);
            }
          }
        }
      }
    });
  });
});
