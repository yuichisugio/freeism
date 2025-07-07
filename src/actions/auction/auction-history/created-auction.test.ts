import type { AuctionCreatedTabFilter, FilterCondition } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { TaskStatus } from "@prisma/client";
import { describe, expect, test } from "vitest";

import {
  getUserCreatedAuctions,
  getUserCreatedAuctionsCount,
  getUserCreatedAuctionsWhereCondition,
} from "./created-auction";

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("created-auction", () => {
  describe("getUserCreatedAuctionsWhereCondition", () => {
    describe("異常系", () => {
      test.each([
        { userId: "", filter: "creator", filterCondition: "and", description: "userId is empty" },
        { userId: null, filter: "creator", filterCondition: "and", description: "userId is null" },
        { userId: undefined, filter: "creator", filterCondition: "and", description: "userId is undefined" },
        { userId: TEST_CONSTANTS.USER_ID, filter: null, filterCondition: "and", description: "filter is null" },
        {
          userId: TEST_CONSTANTS.USER_ID,
          filter: undefined,
          filterCondition: "and",
          description: "filter is undefined",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          filter: ["creator"],
          filterCondition: "",
          description: "filterCondition is empty",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          filter: ["creator"],
          filterCondition: null,
          description: "filterCondition is null",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          filter: ["creator"],
          filterCondition: undefined,
          description: "filterCondition is undefined",
        },
      ])("should throw error when $description", async ({ userId, filter, filterCondition }) => {
        await expect(
          getUserCreatedAuctionsWhereCondition(
            userId as unknown as string,
            filter as unknown as AuctionCreatedTabFilter[],
            filterCondition as unknown as FilterCondition,
          ),
        ).rejects.toThrow(ERROR_MESSAGES.WHERE_CONDITION);
      });
    });

    describe("正常系", () => {
      describe("ロールフィルター", () => {
        test.each([
          {
            description: "no filter parameter to default role condition",
            filters: [] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
              task: {
                OR: [
                  { creatorId: TEST_CONSTANTS.USER_ID },
                  { executors: { some: { userId: TEST_CONSTANTS.USER_ID } } },
                  { reporters: { some: { userId: TEST_CONSTANTS.USER_ID } } },
                ],
              },
            },
          },
          {
            description: "single role filter with AND condition",
            filters: ["creator"] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
              task: { AND: [{ creatorId: TEST_CONSTANTS.USER_ID }] },
            },
          },
          {
            description: "single role filter with OR condition",
            filters: ["creator"] as AuctionCreatedTabFilter[],
            condition: "or" as FilterCondition,
            expected: {
              task: { OR: [{ creatorId: TEST_CONSTANTS.USER_ID }] },
            },
          },
          {
            description: "multiple role filters with AND condition",
            filters: ["creator", "executor"] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
              task: {
                AND: [
                  { creatorId: TEST_CONSTANTS.USER_ID },
                  { executors: { some: { userId: TEST_CONSTANTS.USER_ID } } },
                ],
              },
            },
          },
          {
            description: "multiple role filters with OR condition",
            filters: ["creator", "executor"] as AuctionCreatedTabFilter[],
            condition: "or" as FilterCondition,
            expected: {
              task: {
                OR: [
                  { creatorId: TEST_CONSTANTS.USER_ID },
                  { executors: { some: { userId: TEST_CONSTANTS.USER_ID } } },
                ],
              },
            },
          },
        ])("should handle $description", async ({ filters, condition, expected }) => {
          const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, filters, condition);
          expect(result).toStrictEqual(expected);
        });
      });

      describe("ステータスフィルター", () => {
        test.each([
          {
            description: "active status filter",
            status: ["active"] as AuctionCreatedTabFilter[],
            expectedStatuses: [TaskStatus.AUCTION_ACTIVE],
          },
          {
            description: "ended status filter",
            status: ["ended"] as AuctionCreatedTabFilter[],
            expectedStatuses: [TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED],
          },
          {
            description: "pending status filter",
            status: ["pending"] as AuctionCreatedTabFilter[],
            expectedStatuses: [TaskStatus.PENDING],
          },
          {
            description: "supplier_done status filter",
            status: ["supplier_done"] as AuctionCreatedTabFilter[],
            expectedStatuses: [
              TaskStatus.SUPPLIER_DONE,
              TaskStatus.TASK_COMPLETED,
              TaskStatus.FIXED_EVALUATED,
              TaskStatus.POINTS_AWARDED,
            ],
          },
          {
            description: "multiple status filters with AND condition",
            status: ["active", "ended"] as AuctionCreatedTabFilter[],
            expectedStatuses: [TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED],
          },
          {
            description: "multiple status filters with OR condition",
            status: ["active", "ended"] as AuctionCreatedTabFilter[],
            expectedStatuses: [TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED],
          },
          {
            description: "all status filters combined",
            status: ["active", "ended", "pending", "supplier_done"] as AuctionCreatedTabFilter[],
            expectedStatuses: [
              TaskStatus.AUCTION_ACTIVE,
              TaskStatus.AUCTION_ENDED,
              TaskStatus.POINTS_DEPOSITED,
              TaskStatus.PENDING,
              TaskStatus.SUPPLIER_DONE,
              TaskStatus.TASK_COMPLETED,
              TaskStatus.FIXED_EVALUATED,
              TaskStatus.POINTS_AWARDED,
            ],
          },
        ])("should handle $description", async ({ status, expectedStatuses }) => {
          const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, status, "and");
          expect(result).toStrictEqual({
            AND: [createDefaultRoleCondition(TEST_CONSTANTS.USER_ID), createStatusCondition(expectedStatuses)],
          });
        });
      });

      describe("ロールとステータスの複合フィルター条件", () => {
        test.each([
          {
            description: "role and status filters with AND condition",
            filters: ["creator", "active"] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
              AND: [
                { task: { AND: [{ creatorId: TEST_CONSTANTS.USER_ID }] } },
                createStatusCondition([TaskStatus.AUCTION_ACTIVE]),
              ],
            },
          },
          {
            description: "role and status filters with OR condition",
            filters: ["creator", "active"] as AuctionCreatedTabFilter[],
            condition: "or" as FilterCondition,
            expected: {
              OR: [
                { task: { OR: [{ creatorId: TEST_CONSTANTS.USER_ID }] } },
                createStatusCondition([TaskStatus.AUCTION_ACTIVE]),
              ],
            },
          },
          {
            description: "multiple roles and statuses with AND condition",
            filters: [
              "creator",
              "executor",
              "reporter",
              "active",
              "ended",
              "pending",
              "supplier_done",
            ] as AuctionCreatedTabFilter[],
            condition: "and" as FilterCondition,
            expected: {
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
            },
          },
        ])("should handle $description", async ({ filters, condition, expected }) => {
          const result = await getUserCreatedAuctionsWhereCondition(TEST_CONSTANTS.USER_ID, filters, condition);
          expect(result).toStrictEqual(expected);
        });
      });
    });
  });

  describe("getUserCreatedAuctions", () => {
    describe("異常系", () => {
      test.each([
        { userId: "", itemPerPage: 0, page: 1, filter: [], filterCondition: "and", description: "userId is empty" },
        { userId: null, itemPerPage: 0, page: 1, filter: [], filterCondition: "and", description: "userId is null" },
        {
          userId: undefined,
          itemPerPage: 0,
          page: 1,
          filter: [],
          filterCondition: "and",
          description: "userId is undefined",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: 1,
          filter: [],
          filterCondition: "and",
          description: "itemPerPage is 0",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: null,
          page: 1,
          filter: [],
          filterCondition: "and",
          description: "itemPerPage is null",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: undefined,
          page: 1,
          filter: [],
          filterCondition: "and",
          description: "itemPerPage is undefined",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: 0,
          filter: [],
          filterCondition: "and",
          description: "page is 0",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: null,
          filter: [],
          filterCondition: "and",
          description: "page is null",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: undefined,
          filter: [],
          filterCondition: "and",
          description: "page is undefined",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: 1,
          filter: null,
          filterCondition: "and",
          description: "filter is null",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: 1,
          filter: undefined,
          filterCondition: "and",
          description: "filter is undefined",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: 1,
          filter: [],
          filterCondition: null,
          description: "filterCondition is null",
        },
        {
          userId: TEST_CONSTANTS.USER_ID,
          itemPerPage: 0,
          page: 1,
          filter: [],
          filterCondition: undefined,
          description: "filterCondition is undefined",
        },
      ])("should throw error when $description", async ({ userId, itemPerPage, page, filter, filterCondition }) => {
        await expect(
          getUserCreatedAuctions(
            page as unknown as number,
            userId as unknown as string,
            itemPerPage as unknown as number,
            filter as unknown as AuctionCreatedTabFilter[],
            filterCondition as unknown as FilterCondition,
          ),
        ).rejects.toThrow(ERROR_MESSAGES.AUCTIONS);
      });
    });

    describe("正常系", () => {
      test("should return empty array when no auctions found", async () => {
        prismaMock.auction.findMany.mockResolvedValue([]);

        const result = await getUserCreatedAuctions(
          TEST_CONSTANTS.PAGE,
          TEST_CONSTANTS.USER_ID,
          TEST_CONSTANTS.ITEM_PER_PAGE,
          [],
          "and",
        );

        expect(result.data).toStrictEqual([]);
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

          const result = await getUserCreatedAuctions(
            TEST_CONSTANTS.PAGE,
            TEST_CONSTANTS.USER_ID,
            TEST_CONSTANTS.ITEM_PER_PAGE,
            [],
            "and",
          );

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
          expect(result.data).toHaveLength(1);
          expect(result.data[0]).toStrictEqual(expected);
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

          const result = await getUserCreatedAuctions(
            TEST_CONSTANTS.PAGE,
            TEST_CONSTANTS.USER_ID,
            TEST_CONSTANTS.ITEM_PER_PAGE,
            [],
            "and",
          );

          const expected = createExpectedAuctionData({
            winnerId: null,
            winnerName: null,
            isCreator: false,
            isExecutor: false,
            isReporter: true,
            taskRole: ["REPORTER"] as ("SUPPLIER" | "EXECUTOR" | "REPORTER")[],
          });
          expect(result.data).toHaveLength(1);
          expect(result.data[0]).toStrictEqual(expected);
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

          const result = await getUserCreatedAuctions(
            TEST_CONSTANTS.PAGE,
            TEST_CONSTANTS.USER_ID,
            TEST_CONSTANTS.ITEM_PER_PAGE,
            [],
            "and",
          );

          const expected = createExpectedAuctionData({
            taskRole: ["SUPPLIER", "EXECUTOR", "REPORTER"] as ("SUPPLIER" | "EXECUTOR" | "REPORTER")[],
            isCreator: true,
            isExecutor: true,
            isReporter: true,
          });
          expect(result.data).toHaveLength(1);
          expect(result.data[0]).toStrictEqual(expected);
        });
      });

      test.each([
        { page: 1, itemPerPage: 5, skip: 0, take: 5, description: "page is 1" },
        { page: 5, itemPerPage: 5, skip: 20, take: 5, description: "page is 2" },
        { page: 3, itemPerPage: 10, skip: 20, take: 10, description: "page is 3" },
      ])("should handle pagination parameters correctly", async ({ page, itemPerPage, skip, take }) => {
        prismaMock.auction.findMany.mockResolvedValue([]);

        await getUserCreatedAuctions(page, TEST_CONSTANTS.USER_ID, itemPerPage, [], "and");

        expect(prismaMock.auction.findMany).toHaveBeenCalledWith({
          where: expect.any(Object) as Prisma.AuctionWhereInput,
          orderBy: { createdAt: "desc" },
          skip,
          take,
          select: expect.any(Object) as Prisma.AuctionSelect,
        });
      });
    });
  });

  describe("getUserCreatedAuctionsCount", () => {
    describe("異常系", () => {
      test.each([
        { userId: "", filter: [], filterCondition: "and", description: "userId is empty" },
        { userId: null, filter: [], filterCondition: "and", description: "userId is null" },
        { userId: undefined, filter: [], filterCondition: "and", description: "userId is undefined" },
        { userId: TEST_CONSTANTS.USER_ID, filter: null, filterCondition: "and", description: "filter is null" },
        {
          userId: TEST_CONSTANTS.USER_ID,
          filter: undefined,
          filterCondition: "and",
          description: "filter is undefined",
        },
        { userId: TEST_CONSTANTS.USER_ID, filter: [], filterCondition: null, description: "filterCondition is null" },
        {
          userId: TEST_CONSTANTS.USER_ID,
          filter: [],
          filterCondition: undefined,
          description: "filterCondition is undefined",
        },
      ])("should throw error when $description", async ({ userId, filter, filterCondition }) => {
        await expect(
          getUserCreatedAuctionsCount(
            userId as unknown as string,
            filter as unknown as AuctionCreatedTabFilter[],
            filterCondition as unknown as FilterCondition,
          ),
        ).rejects.toThrow(ERROR_MESSAGES.COUNT);
      });
    });

    describe("正常系", () => {
      test.each([
        { count: 0, description: "no auctions found" },
        { count: 15, description: "auctions exist" },
      ])("should return $count when $description", async ({ count }) => {
        prismaMock.auction.count.mockResolvedValue(count as unknown as number);

        const result = await getUserCreatedAuctionsCount(TEST_CONSTANTS.USER_ID, [], "and");

        expect(result.data).toBe(count);
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

          expect(result.data).toBe(5);
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
