import type { AuctionCreatedTabFilter, FilterCondition } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { getUserCreatedAuctions, getUserCreatedAuctionsCount, getUserCreatedAuctionsWhereCondition } from "./created-auction";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト用定数
 */
const TEST_CONSTANTS = {
  USER_ID: "test-user-id",
  OTHER_USER_ID: "other-user-id",
  REPORTER_USER_ID: "reporter-1",
  PAGE: 1,
  ITEM_PER_PAGE: 10,
} as const;

/**
 * エラーメッセージ定数（統合済み）
 */
const ERROR_MESSAGES = {
  WHERE_CONDITION: "userId, filter, and filterCondition are required",
  AUCTIONS: "userId, itemPerPage, page, filter, and filterCondition are required",
  COUNT: "userId, filter, and filterCondition are required",
} as const;

/**
 * テストデータ作成ヘルパー関数（統合済み）
 */
const createMockAuctionData = (
  overrides: {
    id?: string;
    currentHighestBid?: number;
    endTime?: Date;
    createdAt?: Date;
    task?: {
      id?: string;
      task?: string;
      status?: TaskStatus;
      deliveryMethod?: string;
      creator?: { id: string };
      executors?: { userId: string }[];
      reporters?: { userId: string }[];
    };
    winner?: { id: string; name: string } | null;
  } = {},
) => ({
  id: overrides.id ?? "auction-1",
  currentHighestBid: overrides.currentHighestBid ?? 1000,
  endTime: overrides.endTime ?? new Date("2024-01-03"),
  createdAt: overrides.createdAt ?? new Date("2024-01-01"),
  task: {
    id: overrides.task?.id ?? "task-1",
    task: overrides.task?.task ?? "Test Task 1",
    status: overrides.task?.status ?? TaskStatus.AUCTION_ACTIVE,
    deliveryMethod: overrides.task?.deliveryMethod ?? "online",
    creator: { id: overrides.task?.creator?.id ?? TEST_CONSTANTS.USER_ID },
    executors: overrides.task?.executors ?? [],
    reporters: overrides.task?.reporters ?? [],
  },
  winner: overrides.winner !== undefined ? overrides.winner : null,
});

/**
 * 期待される返却データ作成ヘルパー関数（統合済み）
 */
const createExpectedAuctionData = (
  overrides: {
    auctionId?: string;
    currentHighestBid?: number;
    auctionEndTime?: Date;
    auctionCreatedAt?: Date;
    taskId?: string;
    taskName?: string;
    taskStatus?: TaskStatus;
    deliveryMethod?: string;
    winnerId?: string | null;
    winnerName?: string | null;
    isCreator?: boolean;
    isExecutor?: boolean;
    isReporter?: boolean;
    taskRole?: ("SUPPLIER" | "EXECUTOR" | "REPORTER")[];
  } = {},
) => ({
  auctionId: overrides.auctionId ?? "auction-1",
  currentHighestBid: overrides.currentHighestBid ?? 1000,
  auctionEndTime: overrides.auctionEndTime ?? new Date("2024-01-03"),
  auctionCreatedAt: overrides.auctionCreatedAt ?? new Date("2024-01-01"),
  taskId: overrides.taskId ?? "task-1",
  taskName: overrides.taskName ?? "Test Task 1",
  taskStatus: overrides.taskStatus ?? TaskStatus.AUCTION_ACTIVE,
  deliveryMethod: overrides.deliveryMethod ?? "online",
  winnerId: overrides.winnerId !== undefined ? overrides.winnerId : null,
  winnerName: overrides.winnerName !== undefined ? overrides.winnerName : null,
  isCreator: overrides.isCreator ?? false,
  isExecutor: overrides.isExecutor ?? false,
  isReporter: overrides.isReporter ?? false,
  taskRole: overrides.taskRole ?? [],
});

/**
 * 共通のデフォルトロール条件作成ヘルパー
 */
const createDefaultRoleCondition = (userId: string) => ({
  task: {
    OR: [{ creatorId: userId }, { executors: { some: { userId } } }, { reporters: { some: { userId } } }],
  },
});

/**
 * ステータス条件作成ヘルパー
 */
const createStatusCondition = (statusFilters: TaskStatus[]) => ({
  task: {
    status: {
      in: statusFilters,
    },
  },
});

beforeEach(() => {
  // コンソールログをモック化（テスト出力をクリーンに保つ）
  vi.spyOn(console, "log").mockImplementation(() => {
    // テスト中のコンソール出力を抑制
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("created-auction", () => {
  describe("getUserCreatedAuctionsWhereCondition", () => {
    describe("パラメータ検証", () => {
      test("should throw error when userId is missing", async () => {
        await expect(getUserCreatedAuctionsWhereCondition("", [], "and")).rejects.toThrow(ERROR_MESSAGES.WHERE_CONDITION);
      });

      test("should throw error when filter is null", async () => {
        await expect(
          getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, null as unknown as AuctionCreatedTabFilter[], "and"),
        ).rejects.toThrow(ERROR_MESSAGES.WHERE_CONDITION);
      });

      test("should throw error when filterCondition is null", async () => {
        await expect(getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, [], null as unknown as FilterCondition)).rejects.toThrow(
          ERROR_MESSAGES.WHERE_CONDITION,
        );
      });
    });

    describe("フィルター条件の組み立て", () => {
      test("should return default role condition when filter is empty", async () => {
        const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, [], "and");
        expect(result).toStrictEqual(createDefaultRoleCondition(TEST_CONSTANTS.USER_ID));
      });

      describe("ロールフィルター", () => {
        const roleTestCases = [
          {
            description: "creator filter with AND condition",
            filters: ["creator"] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
              task: { AND: [{ creatorId: TEST_CONSTANTS.USER_ID }] },
            },
          },
          {
            description: "multiple role filters with AND condition",
            filters: ["creator", "executor"] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
              task: {
                AND: [{ creatorId: TEST_CONSTANTS.USER_ID }, { executors: { some: { userId: TEST_CONSTANTS.USER_ID } } }],
              },
            },
          },
          {
            description: "multiple role filters with OR condition",
            filters: ["creator", "executor"] as AuctionCreatedTabFilter[],
            condition: "or" as FilterCondition,
            expected: {
              task: {
                OR: [{ creatorId: TEST_CONSTANTS.USER_ID }, { executors: { some: { userId: TEST_CONSTANTS.USER_ID } } }],
              },
            },
          },
        ];

        roleTestCases.forEach(({ description, filters, condition, expected }) => {
          test(`should handle ${String(description)}`, async () => {
            const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, filters, condition);
            expect(result).toStrictEqual(expected);
          });
        });
      });

      describe("ステータスフィルター", () => {
        const statusTestCases = [
          {
            status: "active" as AuctionCreatedTabFilter,
            expectedStatuses: [TaskStatus.AUCTION_ACTIVE],
          },
          {
            status: "ended" as AuctionCreatedTabFilter,
            expectedStatuses: [TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED],
          },
          {
            status: "pending" as AuctionCreatedTabFilter,
            expectedStatuses: [TaskStatus.PENDING],
          },
          {
            status: "supplier_done" as AuctionCreatedTabFilter,
            expectedStatuses: [TaskStatus.SUPPLIER_DONE, TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED],
          },
        ];

        statusTestCases.forEach(({ status, expectedStatuses }) => {
          test(`should handle ${String(status)} status filter`, async () => {
            const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, [status], "and");
            expect(result).toStrictEqual({
              AND: [createDefaultRoleCondition(TEST_CONSTANTS.USER_ID), createStatusCondition(expectedStatuses)],
            });
          });
        });
      });

      describe("複合フィルター条件", () => {
        test("should handle multiple status filters", async () => {
          const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, ["active", "ended"], "and");
          expect(result).toStrictEqual({
            AND: [
              createDefaultRoleCondition(TEST_CONSTANTS.USER_ID),
              createStatusCondition([TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED]),
            ],
          });
        });

        test("should handle role and status filters with OR condition", async () => {
          const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, ["creator", "active"], "or");
          expect(result).toStrictEqual({
            OR: [{ task: { OR: [{ creatorId: TEST_CONSTANTS.USER_ID }] } }, createStatusCondition([TaskStatus.AUCTION_ACTIVE])],
          });
        });

        test("should handle all filter types", async () => {
          const result = await getUserCreatedAuctionsWhereCondition(
            TEST_CONSTANTS.USER_ID,
            ["creator", "executor", "reporter", "active", "ended", "pending", "supplier_done"],
            "and",
          );
          expect(result).toStrictEqual({
            AND: [
              {
                task: {
                  AND: [
                    { creatorId: TEST_CONSTANTS.USER_ID },
                    { executors: { some: { userId: TEST_CONSTANTS.USER_ID } } },
                    { reporters: { some: { userId: TEST_CONSTANTS.USER_ID } } },
                  ],
                },
              },
              createStatusCondition([
                TaskStatus.AUCTION_ACTIVE,
                TaskStatus.AUCTION_ENDED,
                TaskStatus.POINTS_DEPOSITED,
                TaskStatus.PENDING,
                TaskStatus.SUPPLIER_DONE,
                TaskStatus.TASK_COMPLETED,
                TaskStatus.FIXED_EVALUATED,
                TaskStatus.POINTS_AWARDED,
              ]),
            ],
          });
        });
      });
    });
  });

  describe("getUserCreatedAuctions", () => {
    describe("パラメータ検証", () => {
      test("should throw error when userId is missing", async () => {
        await expect(getUserCreatedAuctions(TEST_CONSTANTS.PAGE, "", TEST_CONSTANTS.ITEM_PER_PAGE, [], "and")).rejects.toThrow(
          ERROR_MESSAGES.AUCTIONS,
        );
      });

      test("should throw error when itemPerPage is 0", async () => {
        await expect(getUserCreatedAuctions(TEST_CONSTANTS.PAGE, TEST_CONSTANTS.USER_ID, 0, [], "and")).rejects.toThrow(ERROR_MESSAGES.AUCTIONS);
      });

      test("should throw error when page is 0", async () => {
        await expect(getUserCreatedAuctions(0, TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.ITEM_PER_PAGE, [], "and")).rejects.toThrow(
          ERROR_MESSAGES.AUCTIONS,
        );
      });

      test("should throw error when filter is null", async () => {
        await expect(
          getUserCreatedAuctions(
            TEST_CONSTANTS.PAGE,
            TEST_CONSTANTS.USER_ID,
            TEST_CONSTANTS.ITEM_PER_PAGE,
            null as unknown as AuctionCreatedTabFilter[],
            "and",
          ),
        ).rejects.toThrow(ERROR_MESSAGES.AUCTIONS);
      });

      test("should throw error when filterCondition is null", async () => {
        await expect(
          getUserCreatedAuctions(TEST_CONSTANTS.PAGE, TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.ITEM_PER_PAGE, [], null as unknown as FilterCondition),
        ).rejects.toThrow(ERROR_MESSAGES.AUCTIONS);
      });
    });

    describe("データ取得と整形", () => {
      test("should return empty array when no auctions found", async () => {
        prismaMock.auction.findMany.mockResolvedValue([]);

        const result = await getUserCreatedAuctions(TEST_CONSTANTS.PAGE, TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.ITEM_PER_PAGE, [], "and");

        expect(result).toStrictEqual([]);
      });

      describe("オークションデータの整形", () => {
        test("should return formatted auction data with winner", async () => {
          const mockData = createMockAuctionData({
            id: "auction-1",
            currentHighestBid: 2000,
            task: {
              creator: { id: TEST_CONSTANTS.USER_ID },
              executors: [{ userId: TEST_CONSTANTS.USER_ID }],
              reporters: [{ userId: TEST_CONSTANTS.REPORTER_USER_ID }],
            },
            winner: { id: "winner-1", name: "Winner Name" },
          });
          prismaMock.auction.findMany.mockResolvedValue([mockData] as never);

          const result = await getUserCreatedAuctions(TEST_CONSTANTS.PAGE, TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.ITEM_PER_PAGE, [], "and");

          const expected = createExpectedAuctionData({
            auctionId: "auction-1",
            currentHighestBid: 2000,
            winnerId: "winner-1",
            winnerName: "Winner Name",
            isCreator: true,
            isExecutor: true,
            isReporter: false,
            taskRole: ["SUPPLIER", "EXECUTOR"] as ("SUPPLIER" | "EXECUTOR" | "REPORTER")[],
          });
          expect(result).toHaveLength(1);
          expect(result[0]).toStrictEqual(expected);
        });

        test("should handle auction with no winner", async () => {
          const mockData = createMockAuctionData({
            currentHighestBid: 1000,
            task: {
              creator: { id: TEST_CONSTANTS.OTHER_USER_ID },
              executors: [],
              reporters: [{ userId: TEST_CONSTANTS.USER_ID }],
            },
            winner: null,
          });
          prismaMock.auction.findMany.mockResolvedValue([mockData] as never);

          const result = await getUserCreatedAuctions(TEST_CONSTANTS.PAGE, TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.ITEM_PER_PAGE, [], "and");

          const expected = createExpectedAuctionData({
            winnerId: null,
            winnerName: null,
            isCreator: false,
            isExecutor: false,
            isReporter: true,
            taskRole: ["REPORTER"] as ("SUPPLIER" | "EXECUTOR" | "REPORTER")[],
          });
          expect(result).toHaveLength(1);
          expect(result[0]).toStrictEqual(expected);
        });

        test("should handle multiple task roles correctly", async () => {
          const mockData = createMockAuctionData({
            task: {
              creator: { id: TEST_CONSTANTS.USER_ID },
              executors: [{ userId: TEST_CONSTANTS.USER_ID }],
              reporters: [{ userId: TEST_CONSTANTS.USER_ID }],
            },
          });
          prismaMock.auction.findMany.mockResolvedValue([mockData] as never);

          const result = await getUserCreatedAuctions(TEST_CONSTANTS.PAGE, TEST_CONSTANTS.USER_ID, TEST_CONSTANTS.ITEM_PER_PAGE, [], "and");

          const expected = createExpectedAuctionData({
            taskRole: ["SUPPLIER", "EXECUTOR", "REPORTER"] as ("SUPPLIER" | "EXECUTOR" | "REPORTER")[],
            isCreator: true,
            isExecutor: true,
            isReporter: true,
          });
          expect(result).toHaveLength(1);
          expect(result[0]).toStrictEqual(expected);
        });
      });

      test("should handle pagination parameters correctly", async () => {
        prismaMock.auction.findMany.mockResolvedValue([]);

        await getUserCreatedAuctions(2, TEST_CONSTANTS.USER_ID, 5, [], "and");

        expect(prismaMock.auction.findMany).toHaveBeenCalledWith({
          where: expect.any(Object) as Prisma.AuctionWhereInput,
          orderBy: { createdAt: "desc" },
          skip: 5, // (page - 1) * itemPerPage = (2 - 1) * 5
          take: 5,
          select: expect.any(Object) as Prisma.AuctionSelect,
        });
      });
    });
  });

  describe("getUserCreatedAuctionsCount", () => {
    describe("パラメータ検証", () => {
      test("should throw error when userId is missing", async () => {
        await expect(getUserCreatedAuctionsCount("", [], "and")).rejects.toThrow(ERROR_MESSAGES.COUNT);
      });

      test("should throw error when filter is null", async () => {
        await expect(getUserCreatedAuctionsCount(TEST_CONSTANTS.USER_ID, null as unknown as AuctionCreatedTabFilter[], "and")).rejects.toThrow(
          ERROR_MESSAGES.COUNT,
        );
      });

      test("should throw error when filterCondition is null", async () => {
        await expect(getUserCreatedAuctionsCount(TEST_CONSTANTS.USER_ID, [], null as unknown as FilterCondition)).rejects.toThrow(
          ERROR_MESSAGES.COUNT,
        );
      });
    });

    describe("件数取得", () => {
      const countTestCases = [
        { count: 0, description: "no auctions found" },
        { count: 15, description: "auctions exist" },
      ];

      countTestCases.forEach(({ count, description }) => {
        test(`should return ${String(count)} when ${String(description)}`, async () => {
          prismaMock.auction.count.mockResolvedValue(count);

          const result = await getUserCreatedAuctionsCount(TEST_CONSTANTS.USER_ID, [], "and");

          expect(result).toBe(count);
        });
      });

      describe("フィルター条件での件数取得", () => {
        test("should call prisma count with correct parameters for AND condition", async () => {
          prismaMock.auction.count.mockResolvedValue(10);

          await getUserCreatedAuctionsCount(TEST_CONSTANTS.USER_ID, ["active"], "and");

          expect(prismaMock.auction.count).toHaveBeenCalledWith({
            where: expect.objectContaining({
              AND: expect.any(Array) as Prisma.AuctionWhereInput[],
            }) as Prisma.AuctionWhereInput,
          });
        });

        test("should handle different filter conditions with OR", async () => {
          prismaMock.auction.count.mockResolvedValue(5);

          const result = await getUserCreatedAuctionsCount(TEST_CONSTANTS.USER_ID, ["creator", "ended"], "or");

          expect(result).toBe(5);
          expect(prismaMock.auction.count).toHaveBeenCalledWith({
            where: expect.objectContaining({
              OR: expect.any(Array) as Prisma.AuctionWhereInput[],
            }) as Prisma.AuctionWhereInput,
          });
        });
      });
    });
  });
});
