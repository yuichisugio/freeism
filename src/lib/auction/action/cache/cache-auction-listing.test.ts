import type { AuctionListingsConditions } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { TaskStatus } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GetAuctionListingsParams } from "./cache-auction-listing";
import { cachedGetAuctionListingsAndCount } from "./cache-auction-listing";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 各テスト前にモックをリセット
 */
beforeEach(() => {
  vi.clearAllMocks();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストデータの定義
 */
const testUserId = "test-user-id";
const testGroupId = "test-group-id";
const testAuctionId = "test-auction-id";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のテストデータ
 */
const mockListingsConditions: AuctionListingsConditions = {
  categories: ["プログラミング"],
  status: ["not_ended"],
  statusConditionJoinType: "OR",
  minBid: 100,
  maxBid: 1000,
  minRemainingTime: 1,
  maxRemainingTime: 24,
  groupIds: [testGroupId],
  searchQuery: "テスト",
  sort: [{ field: "newest", direction: "desc" }],
  page: 1,
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のモックデータを生成するヘルパー関数
 */
const createMockRawAuctionData = (overrides = {}) => ({
  id: testAuctionId,
  current_highest_bid: 500,
  end_time: new Date("2024-12-31T23:59:59Z"),
  start_time: new Date("2024-01-01T00:00:00Z"),
  status: TaskStatus.PENDING,
  created_at: new Date("2024-01-01T00:00:00Z"),
  task: "テストタスク",
  detail: "テストタスクの詳細",
  image_url: "https://example.com/image.jpg",
  category: "プログラミング",
  group_id: testGroupId,
  group_name: "テストグループ",
  bids_count: BigInt(5),
  is_watched: false,
  executors_json: JSON.stringify([
    {
      id: "executor-1",
      user_id: "executor-user-1",
      user_image: "https://example.com/executor.jpg",
      username: "実行者1",
      rating: 4.5,
    },
  ]),
  score: 0.95,
  task_highlighted: "<mark>テスト</mark>タスク",
  detail_highlighted: "<mark>テスト</mark>タスクの詳細",
  _dummy: false,
  ...overrides,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のパラメータを生成するヘルパー関数
 */
const createMockParams = (conditionsOverrides = {}, userId = testUserId): GetAuctionListingsParams => ({
  listingsConditions: { ...mockListingsConditions, ...conditionsOverrides },
  userId,
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 共通のモックセットアップを行うヘルパー関数
 */
const setupMockWithGroupMembership = (groupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })]) => {
  prismaMock.groupMembership.findMany.mockResolvedValue(groupMemberships);
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 成功ケースの共通モックセットアップ
 */
const setupSuccessfulMocks = (
  auctionData = [
    createMockRawAuctionData({ id: `${testAuctionId}-1`, status: TaskStatus.PENDING }),
    createMockRawAuctionData({ id: `${testAuctionId}-2`, status: TaskStatus.AUCTION_ACTIVE }),
    createMockRawAuctionData({ id: `${testAuctionId}-3`, status: TaskStatus.POINTS_AWARDED }),
    createMockRawAuctionData({ id: `${testAuctionId}-4`, status: TaskStatus.POINTS_DEPOSITED }),
    createMockRawAuctionData({ id: `${testAuctionId}-5`, status: TaskStatus.ARCHIVED }),
  ],
  count?: bigint,
) => {
  // countが指定されていない場合は、auctionDataの長さをcountとして使用
  const actualCount = count ?? BigInt(auctionData.length);
  const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
  const mockCountResult = [{ count: actualCount }];

  setupMockWithGroupMembership(mockGroupMemberships);
  prismaMock.$queryRaw
    .mockResolvedValueOnce(auctionData) // listings query
    .mockResolvedValueOnce(mockCountResult); // count query
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * パラメータ化テスト用のテストケース配列を生成するヘルパー
 */
const createParameterizedTestCases = <T>(testCases: Array<{ name: string; input: T; expected?: unknown }>) => testCases;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト実装
 */
describe("cache-auction-listing", () => {
  describe("cachedGetAuctionListingsAndCount", () => {
    describe("正常系テスト", () => {
      test("should return auction listings and count successfully", async () => {
        // Arrange
        const mockParams = createMockParams();
        setupSuccessfulMocks();

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(5);
        expect(result.count).toBe(5);
        expect(result.listings[0].id).toBe(`${testAuctionId}-1`);
        expect(result.listings[0].bids_count).toBe(5);
        expect(result.listings[0].is_watched).toBe(false);
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: testUserId },
          select: { groupId: true },
        });
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      });

      test("should handle empty auction data", async () => {
        // Arrange
        const mockParams = createMockParams();
        setupSuccessfulMocks([], BigInt(0));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      });

      test("should handle large count value", async () => {
        // Arrange
        const mockParams = createMockParams();
        const maxCount = Number.MAX_SAFE_INTEGER;
        setupSuccessfulMocks([], BigInt(maxCount));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(maxCount);
      });
    });

    describe("グループメンバーシップ関連テスト", () => {
      test("should return empty results when user has no group memberships", async () => {
        // Arrange
        const mockParams = createMockParams();
        setupMockWithGroupMembership([]);

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
          where: { userId: testUserId },
          select: { groupId: true },
        });
        expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      });

      test("should return empty when specified groupIds are not accessible to user", async () => {
        // Arrange
        const inaccessibleGroupId = "inaccessible-group-id";
        const mockParams = createMockParams({ groupIds: [inaccessibleGroupId] });
        const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
        setupMockWithGroupMembership(mockGroupMemberships);

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert - Early return due to no accessible groups
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
        expect(prismaMock.$queryRaw).not.toHaveBeenCalled(); // Should not reach query execution
      });

      test("should handle mixed accessible and inaccessible groupIds", async () => {
        // Arrange
        const inaccessibleGroupId = "inaccessible-group-id";
        const mockParams = createMockParams({ groupIds: [testGroupId, inaccessibleGroupId] });
        setupSuccessfulMocks([], BigInt(0));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert - Should only filter by accessible groups
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2); // Should reach query execution
      });
    });

    describe("executors_json処理テスト", () => {
      const executorsJsonTestCases = createParameterizedTestCases([
        {
          name: "should handle null executors_json",
          input: { executors_json: null },
        },
        {
          name: "should handle invalid JSON in executors_json",
          input: { executors_json: "invalid json" },
        },
        {
          name: "should handle executors_json with non-array data",
          input: { executors_json: JSON.stringify({ notArray: "data" }) },
        },
      ]);

      test.each(executorsJsonTestCases)("$name", async ({ input }) => {
        // Arrange
        const mockParams = createMockParams();
        const mockData = createMockRawAuctionData({
          ...input,
          detail: null,
          image_url: null,
          category: null,
          bids_count: null,
          is_watched: null,
          score: null,
          task_highlighted: null,
          detail_highlighted: null,
        });
        setupSuccessfulMocks([mockData], BigInt(1));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(1);
        expect(result.listings[0].executors_json).toStrictEqual([]);
      });

      test("should handle executors_json with missing fields", async () => {
        // Arrange
        const mockParams = createMockParams();
        const mockData = createMockRawAuctionData({
          executors_json: JSON.stringify([
            {
              id: "executor-1",
              user_id: null, // Missing user_id
              user_image: null,
              username: null,
              rating: null,
            },
            {
              // Missing required fields completely
              incomplete: "data",
            },
          ]),
          detail: null,
          image_url: null,
          category: null,
          bids_count: null,
          is_watched: null,
          score: null,
          task_highlighted: null,
          detail_highlighted: null,
        });
        setupSuccessfulMocks([mockData], BigInt(1));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(1);
        expect(Array.isArray(result.listings[0].executors_json)).toBe(true);
        if (Array.isArray(result.listings[0].executors_json)) {
          expect(result.listings[0].executors_json).toHaveLength(1); // Only valid executor should be included
          expect(result.listings[0].executors_json[0].userSettingsUsername).toBe("未設定");
        }
      });

      test("should handle executors_json with correct username fallback", async () => {
        // Arrange
        const mockParams = createMockParams();
        const mockData = createMockRawAuctionData({
          executors_json: JSON.stringify([
            {
              id: "executor-1",
              user_id: "user-1",
              user_image: "https://example.com/user.jpg",
              username: "実行者1", // Has username
              rating: 4.5,
            },
            {
              id: "executor-2",
              user_id: "user-2",
              user_image: null,
              username: null, // No username - should fallback to "未設定"
              rating: null,
            },
          ]),
          detail: null,
          image_url: null,
          category: null,
          bids_count: null,
          is_watched: null,
          score: null,
          task_highlighted: null,
          detail_highlighted: null,
        });
        setupSuccessfulMocks([mockData], BigInt(1));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(1);
        expect(Array.isArray(result.listings[0].executors_json)).toBe(true);
        if (Array.isArray(result.listings[0].executors_json)) {
          expect(result.listings[0].executors_json).toHaveLength(2);
          expect(result.listings[0].executors_json[0].userSettingsUsername).toBe("実行者1");
          expect(result.listings[0].executors_json[1].userSettingsUsername).toBe("未設定");
        }
      });
    });

    describe("全文検索（FTS）テスト", () => {
      test("should handle search query with FTS highlighting", async () => {
        // Arrange
        const mockParams = createMockParams({
          searchQuery: "プログラミング JavaScript",
          sort: [{ field: "relevance", direction: "desc" }],
        });
        const mockData = createMockRawAuctionData({
          task: "プログラミングタスク",
          detail: "JavaScript開発",
          image_url: null,
          category: "プログラミング",
          bids_count: BigInt(0),
          is_watched: false,
          executors_json: null,
          score: 0.95,
          task_highlighted: "<mark>プログラミング</mark>タスク",
          detail_highlighted: "<mark>JavaScript</mark>開発",
        });
        setupSuccessfulMocks([mockData], BigInt(1));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(1);
        expect(result.listings[0].task_highlighted).toBe("<mark>プログラミング</mark>タスク");
        expect(result.listings[0].detail_highlighted).toBe("<mark>JavaScript</mark>開発");
        expect(result.listings[0].score).toBe(0.95);
      });

      const searchQueryTestCases = createParameterizedTestCases([
        {
          name: "should handle empty search query",
          input: { searchQuery: "" },
        },
        {
          name: "should handle search query with whitespace normalization",
          input: { searchQuery: "  プログラミング   JavaScript  " },
        },
      ]);

      test.each(searchQueryTestCases)("$name", async ({ input }) => {
        // Arrange
        const mockParams = createMockParams(input);
        setupSuccessfulMocks([], BigInt(0));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      });
    });

    describe("フィルタリング機能テスト", () => {
      const filterTestCases = createParameterizedTestCases([
        {
          name: "should handle different status conditions",
          input: {
            status: ["ended", "watchlist", "bidded"],
            statusConditionJoinType: "AND" as const,
          },
        },
        {
          name: "should handle null categories filter",
          input: { categories: null },
        },
        {
          name: "should handle bid amount filters",
          input: { minBid: 0, maxBid: 0 },
        },
        {
          name: "should handle remaining time filters",
          input: { minRemainingTime: 0, maxRemainingTime: 0 },
        },
        {
          name: "should handle different sort options",
          input: { sort: [{ field: "price" as const, direction: "asc" as const }] },
        },
        {
          name: "should handle pagination",
          input: { page: 2 },
        },
      ]);

      test.each(filterTestCases)("$name", async ({ input }) => {
        // Arrange
        const mockParams = createMockParams(input);
        setupSuccessfulMocks([], BigInt(0));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      });
    });

    describe("異常系・エラーハンドリングテスト", () => {
      test("should handle database error gracefully", async () => {
        // Arrange
        const mockParams = createMockParams();
        prismaMock.groupMembership.findMany.mockRejectedValue(new Error("Database connection error"));

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      });

      const invalidInputTestCases = createParameterizedTestCases([
        {
          name: "should handle null listingsConditions",
          input: { listingsConditions: null as unknown as AuctionListingsConditions, userId: testUserId },
        },
        {
          name: "should handle undefined userId",
          input: { listingsConditions: mockListingsConditions, userId: undefined as unknown as string },
        },
        {
          name: "should handle malformed listingsConditions object",
          input: { listingsConditions: { invalidField: "invalid" } as unknown as AuctionListingsConditions, userId: testUserId },
        },
        {
          name: "should handle non-string userId parameter",
          input: { listingsConditions: mockListingsConditions, userId: 123 as unknown as string },
        },
      ]);

      test.each(invalidInputTestCases)("$name", async ({ input }) => {
        // Act
        const result = await cachedGetAuctionListingsAndCount(input as GetAuctionListingsParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      });

      const prismaErrorTestCases = createParameterizedTestCases([
        {
          name: "should handle $queryRaw error on listings query",
          input: {
            setupMock: () => {
              const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
              setupMockWithGroupMembership(mockGroupMemberships);
              prismaMock.$queryRaw
                .mockRejectedValueOnce(new Error("Database query failed")) // Listings query fails
                .mockResolvedValueOnce([{ count: BigInt(0) }]); // Count query succeeds
            },
          },
        },
        {
          name: "should handle $queryRaw error on count query",
          input: {
            setupMock: () => {
              const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
              setupMockWithGroupMembership(mockGroupMemberships);
              prismaMock.$queryRaw
                .mockResolvedValueOnce([]) // Listings query succeeds
                .mockRejectedValueOnce(new Error("Count query failed")); // Count query fails
            },
          },
        },
        {
          name: "should handle invalid count result structure",
          input: {
            setupMock: () => {
              const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
              setupMockWithGroupMembership(mockGroupMemberships);
              prismaMock.$queryRaw
                .mockResolvedValueOnce([]) // Listings query
                .mockResolvedValueOnce([]); // Empty count result
            },
          },
        },
        {
          name: "should handle undefined count result",
          input: {
            setupMock: () => {
              const mockGroupMemberships = [groupMembershipFactory.build({ userId: testUserId, groupId: testGroupId })];
              setupMockWithGroupMembership(mockGroupMemberships);
              prismaMock.$queryRaw
                .mockResolvedValueOnce([]) // Listings query
                .mockResolvedValueOnce(undefined); // Undefined count result
            },
          },
        },
      ]);

      test.each(prismaErrorTestCases)("$name", async ({ input }) => {
        // Arrange
        const mockParams = createMockParams();
        input.setupMock();

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      });
    });

    describe("ステータスフィルターのテスト", () => {
      // AND条件が渡されたとしても、endedでフィルターをする場合は、endedに該当するステータス(POINTS_AWARDED, POINTS_DEPOSITED, ARCHIVED)はORで結合されているかテストする
      test("should handle 'ended' status filter correctly with AND conditions", async () => {
        // Arrange
        const mockParams = createMockParams({
          status: ["ended"],
          statusConditionJoinType: "and",
          categories: [],
          groupIds: [],
          minBid: null,
          maxBid: null,
          minRemainingTime: null,
          maxRemainingTime: null,
          searchQuery: "",
          sort: [],
          page: 1,
        });
        setupSuccessfulMocks();

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(5);
        expect(result.count).toBe(5);
        expect(result.listings[0].status).toBe(TaskStatus.PENDING);
        expect(result.listings[1].status).toBe(TaskStatus.AUCTION_ACTIVE);
        expect(result.listings[2].status).toBe(TaskStatus.POINTS_AWARDED);
        expect(result.listings[3].status).toBe(TaskStatus.POINTS_DEPOSITED);
        expect(result.listings[4].status).toBe(TaskStatus.ARCHIVED);

        // SQLクエリが正しく呼ばれているかチェック
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      });

      // AND条件が渡されたとしても、not_endedでフィルターをする場合は、not_endedに該当するステータス(PENDING, AUCTION_ACTIVE)はORで結合されているかテストする
      test("should handle 'not_ended' status filter correctly with AND conditions", async () => {
        // Arrange
        const mockParams = createMockParams({
          status: ["not_ended"],
          statusConditionJoinType: "and",
          categories: [],
          groupIds: [],
          minBid: null,
          maxBid: null,
          minRemainingTime: null,
          maxRemainingTime: null,
          searchQuery: "",
          sort: [],
          page: 1,
        });
        setupSuccessfulMocks();

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(5);
        expect(result.count).toBe(5);
        expect(result.listings[0].status).toBe(TaskStatus.PENDING);
        expect(result.listings[1].status).toBe(TaskStatus.AUCTION_ACTIVE);
        expect(result.listings[2].status).toBe(TaskStatus.POINTS_AWARDED);
        expect(result.listings[3].status).toBe(TaskStatus.POINTS_DEPOSITED);
        expect(result.listings[4].status).toBe(TaskStatus.ARCHIVED);

        // SQLクエリが正しく呼ばれているかチェック
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      });

      // AND条件が渡されたとしても、endedとnot_endedでフィルターをする場合は、endedとnot_endedに該当するステータス(PENDING, AUCTION_ACTIVE, POINTS_AWARDED, POINTS_DEPOSITED, ARCHIVED)はORで結合されているかテストする
      test("should handle multiple status return get data with OR conditions", async () => {
        // Arrange
        const mockParams = createMockParams({
          status: ["ended", "not_ended"],
          statusConditionJoinType: "and",
          categories: [],
          groupIds: [],
          minBid: null,
          maxBid: null,
          minRemainingTime: null,
          maxRemainingTime: null,
          searchQuery: "",
          sort: [],
          page: 1,
        });
        setupSuccessfulMocks();

        // Act
        const result = await cachedGetAuctionListingsAndCount(mockParams);

        // Assert
        expect(result.listings).toHaveLength(5);
        expect(result.count).toBe(5);
        expect(result.listings[0].status).toBe(TaskStatus.PENDING);
        expect(result.listings[1].status).toBe(TaskStatus.AUCTION_ACTIVE);
        expect(result.listings[2].status).toBe(TaskStatus.POINTS_AWARDED);
        expect(result.listings[3].status).toBe(TaskStatus.POINTS_DEPOSITED);
        expect(result.listings[4].status).toBe(TaskStatus.ARCHIVED);
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
      });
    });
  });
});
