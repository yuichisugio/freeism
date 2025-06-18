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
 * テストデータの定数
 */
const TEST_CONSTANTS = {
  USER_ID: "test-user-id",
  GROUP_ID: "test-group-id",
  AUCTION_ID: "test-auction-id",
  EXECUTOR_USER_ID: "executor-user-1",
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックデータ生成ヘルパー関数
 */
function createMockAuctionData(overrides = {}) {
  return {
    id: TEST_CONSTANTS.AUCTION_ID,
    current_highest_bid: 1000,
    end_time: new Date("2024-12-31T23:59:59Z"),
    start_time: new Date("2024-01-01T00:00:00Z"),
    status: TaskStatus.AUCTION_ACTIVE,
    created_at: new Date("2024-01-01T00:00:00Z"),
    task: "テストタスク",
    detail: "テストタスクの詳細説明",
    image_url: "https://example.com/image.jpg",
    category: "プログラミング",
    group_id: TEST_CONSTANTS.GROUP_ID,
    group_name: "テストグループ",
    bids_count: BigInt(3),
    is_watched: true,
    executors_json: JSON.stringify([
      {
        id: "executor-1",
        user_id: TEST_CONSTANTS.EXECUTOR_USER_ID,
        user_image: "https://example.com/executor.jpg",
        username: "実行者テストユーザー",
        rating: 4.8,
      },
    ]),
    score: 0.95,
    task_highlighted: "<mark>テスト</mark>タスク",
    detail_highlighted: "<mark>テスト</mark>タスクの詳細説明",
    _dummy: false,
    ...overrides,
  };
}

/**
 * 複数のモックデータ生成
 */
function createMockAuctionDataList(count: number) {
  return Array.from({ length: count }, (_, index) =>
    createMockAuctionData({
      id: `${TEST_CONSTANTS.AUCTION_ID}-${index + 1}`,
      current_highest_bid: 500 + index * 100,
      task: `テストタスク${index + 1}`,
      category: index % 2 === 0 ? "プログラミング" : "デザイン",
      status: index % 3 === 0 ? TaskStatus.PENDING : TaskStatus.AUCTION_ACTIVE,
      bids_count: BigInt(index + 1),
      is_watched: index % 2 === 0,
    }),
  );
}

/**
 * 成功ケースの共通モックセットアップ
 */
function setupSuccessfulMocks(auctionDataCount = 3) {
  const mockAuctionData = createMockAuctionDataList(auctionDataCount);
  const mockCountResult = [{ count: BigInt(auctionDataCount) }];
  const mockGroupMemberships = [
    groupMembershipFactory.build({
      userId: TEST_CONSTANTS.USER_ID,
      groupId: TEST_CONSTANTS.GROUP_ID,
    }),
  ];

  prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
  prismaMock.$queryRaw
    .mockResolvedValueOnce(mockAuctionData) // オークションデータのモック
    .mockResolvedValueOnce(mockCountResult); // 件数のモック
}

/**
 * 共通のパラメータ生成ヘルパー関数
 */
function createTestParams(conditionsOverrides = {}, userId = TEST_CONSTANTS.USER_ID): GetAuctionListingsParams {
  const defaultConditions: AuctionListingsConditions = {
    categories: ["プログラミング"],
    status: ["not_ended"],
    joinType: "OR",
    minBid: null,
    maxBid: null,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: [TEST_CONSTANTS.GROUP_ID],
    searchQuery: null,
    sort: [{ field: "newest", direction: "desc" }],
    page: 1,
  };

  return {
    listingsConditions: { ...defaultConditions, ...conditionsOverrides },
    userId,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト実装
 */
describe("cache-auction-listing.ts_cachedGetAuctionListingsAndCount", () => {
  describe("正常系 - listingsConditionsの値の組み合わせテスト", () => {
    /**
     * カテゴリフィルターのテストケース
     */
    const categoryTestCases = [
      {
        name: "should handle null categories",
        input: { categories: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle empty categories array",
        input: { categories: [] },
        expectedDataCount: 3,
      },
      {
        name: "should handle すべて category",
        input: { categories: ["すべて"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle single category",
        input: { categories: ["プログラミング"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle multiple categories",
        input: { categories: ["プログラミング", "デザイン"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle mixed categories with すべて",
        input: { categories: ["すべて", "プログラミング", "デザイン"] },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(categoryTestCases)("category_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.groupMembership.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_CONSTANTS.USER_ID },
        select: { groupId: true },
      });
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * ステータスフィルターのテストケース
     */
    const statusTestCases = [
      {
        name: "should handle null status",
        input: { status: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle empty status array",
        input: { status: [] },
        expectedDataCount: 3,
      },
      {
        name: "should handle watchlist status",
        input: { status: ["watchlist"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle not_bidded status",
        input: { status: ["not_bidded"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle bidded status",
        input: { status: ["bidded"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle ended status",
        input: { status: ["ended"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle not_ended status",
        input: { status: ["not_ended"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle not_started status",
        input: { status: ["not_started"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle started status",
        input: { status: ["started"] },
        expectedDataCount: 3,
      },
      {
        name: "should handle multiple status with OR condition",
        input: { status: ["watchlist", "bidded"], statusConditionJoinType: "OR" as const },
        expectedDataCount: 3,
      },
      {
        name: "should handle multiple status with AND condition",
        input: { status: ["watchlist", "bidded"], statusConditionJoinType: "AND" as const },
        expectedDataCount: 3,
      },
      {
        name: "should handle complex status combination",
        input: { status: ["ended", "not_ended", "watchlist"], statusConditionJoinType: "OR" as const },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(statusTestCases)("status_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * 入札額フィルターのテストケース
     */
    const bidAmountTestCases = [
      {
        name: "should handle null minBid and maxBid",
        input: { minBid: null, maxBid: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle minBid only",
        input: { minBid: 100, maxBid: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle maxBid only",
        input: { minBid: null, maxBid: 2000 },
        expectedDataCount: 3,
      },
      {
        name: "should handle both minBid and maxBid",
        input: { minBid: 100, maxBid: 2000 },
        expectedDataCount: 3,
      },
      {
        name: "should handle zero minBid",
        input: { minBid: 0, maxBid: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle zero maxBid",
        input: { minBid: null, maxBid: 0 },
        expectedDataCount: 3,
      },
      {
        name: "should handle equal minBid and maxBid",
        input: { minBid: 1000, maxBid: 1000 },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(bidAmountTestCases)("bidAmount_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * 残り時間フィルターのテストケース
     */
    const remainingTimeTestCases = [
      {
        name: "should handle null minRemainingTime and maxRemainingTime",
        input: { minRemainingTime: null, maxRemainingTime: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle minRemainingTime only",
        input: { minRemainingTime: 1, maxRemainingTime: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle maxRemainingTime only",
        input: { minRemainingTime: null, maxRemainingTime: 24 },
        expectedDataCount: 3,
      },
      {
        name: "should handle both minRemainingTime and maxRemainingTime",
        input: { minRemainingTime: 1, maxRemainingTime: 24 },
        expectedDataCount: 3,
      },
      {
        name: "should handle zero minRemainingTime",
        input: { minRemainingTime: 0, maxRemainingTime: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle zero maxRemainingTime",
        input: { minRemainingTime: null, maxRemainingTime: 0 },
        expectedDataCount: 3,
      },
      {
        name: "should handle equal minRemainingTime and maxRemainingTime",
        input: { minRemainingTime: 12, maxRemainingTime: 12 },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(remainingTimeTestCases)("remainingTime_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * グループIDフィルターのテストケース
     */
    const groupIdsTestCases = [
      {
        name: "should handle null groupIds",
        input: { groupIds: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle empty groupIds array",
        input: { groupIds: [] },
        expectedDataCount: 3,
      },
      {
        name: "should handle single groupId",
        input: { groupIds: [TEST_CONSTANTS.GROUP_ID] },
        expectedDataCount: 3,
      },
      {
        name: "should handle multiple groupIds",
        input: { groupIds: [TEST_CONSTANTS.GROUP_ID, "another-group-id"] },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(groupIdsTestCases)("groupIds_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * 検索クエリのテストケース
     */
    const searchQueryTestCases = [
      {
        name: "should handle null searchQuery",
        input: { searchQuery: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle empty searchQuery",
        input: { searchQuery: "" },
        expectedDataCount: 3,
      },
      {
        name: "should handle single word searchQuery",
        input: { searchQuery: "プログラミング" },
        expectedDataCount: 3,
      },
      {
        name: "should handle multiple words searchQuery",
        input: { searchQuery: "プログラミング JavaScript" },
        expectedDataCount: 3,
      },
      {
        name: "should handle searchQuery with special characters",
        input: { searchQuery: "テスト（開発）" },
        expectedDataCount: 3,
      },
      {
        name: "should handle searchQuery with extra spaces",
        input: { searchQuery: "  プログラミング   JavaScript  " },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(searchQueryTestCases)("searchQuery_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * ソートオプションのテストケース
     */
    const sortTestCases = [
      {
        name: "should handle null sort",
        input: { sort: null },
        expectedDataCount: 3,
      },
      {
        name: "should handle empty sort array",
        input: { sort: [] },
        expectedDataCount: 3,
      },
      {
        name: "should handle relevance sort desc",
        input: { sort: [{ field: "relevance" as const, direction: "desc" as const }] },
        expectedDataCount: 3,
      },
      {
        name: "should handle newest sort asc",
        input: { sort: [{ field: "newest" as const, direction: "asc" as const }] },
        expectedDataCount: 3,
      },
      {
        name: "should handle time_remaining sort desc",
        input: { sort: [{ field: "time_remaining" as const, direction: "desc" as const }] },
        expectedDataCount: 3,
      },
      {
        name: "should handle bids sort asc",
        input: { sort: [{ field: "bids" as const, direction: "asc" as const }] },
        expectedDataCount: 3,
      },
      {
        name: "should handle price sort desc",
        input: { sort: [{ field: "price" as const, direction: "desc" as const }] },
        expectedDataCount: 3,
      },
      {
        name: "should handle score sort asc",
        input: { sort: [{ field: "score" as const, direction: "asc" as const }] },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(sortTestCases)("sort_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * ページネーションのテストケース
     */
    const paginationTestCases = [
      {
        name: "should handle page 1",
        input: { page: 1 },
        expectedDataCount: 3,
      },
      {
        name: "should handle page 2",
        input: { page: 2 },
        expectedDataCount: 3,
      },
      {
        name: "should handle large page number",
        input: { page: 100 },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(paginationTestCases)("pagination_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });

    /**
     * 複合条件のテストケース
     */
    const complexConditionsTestCases = [
      {
        name: "should handle complex filter combination 1",
        input: {
          categories: ["プログラミング", "デザイン"],
          status: ["watchlist", "bidded"],
          statusConditionJoinType: "OR" as const,
          minBid: 100,
          maxBid: 2000,
          minRemainingTime: 1,
          maxRemainingTime: 24,
          searchQuery: "テスト",
          sort: [{ field: "price" as const, direction: "desc" as const }],
          page: 1,
        },
        expectedDataCount: 3,
      },
      {
        name: "should handle complex filter combination 2",
        input: {
          categories: null,
          status: ["ended", "not_ended"],
          statusConditionJoinType: "AND" as const,
          minBid: null,
          maxBid: null,
          minRemainingTime: null,
          maxRemainingTime: null,
          groupIds: [TEST_CONSTANTS.GROUP_ID],
          searchQuery: null,
          sort: [{ field: "bids" as const, direction: "asc" as const }],
          page: 2,
        },
        expectedDataCount: 3,
      },
      {
        name: "should handle all null/empty values",
        input: {
          categories: null,
          status: null,
          statusConditionJoinType: "OR" as const,
          minBid: null,
          maxBid: null,
          minRemainingTime: null,
          maxRemainingTime: null,
          groupIds: null,
          searchQuery: null,
          sort: null,
          page: 1,
        },
        expectedDataCount: 3,
      },
    ] as const;

    test.each(complexConditionsTestCases)("complexConditions_$name", async ({ input, expectedDataCount }) => {
      // Arrange
      const params = createTestParams(input);
      setupSuccessfulMocks(expectedDataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(expectedDataCount);
      expect(result.count).toBe(expectedDataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe("正常系 - executors_json処理テスト", () => {
    const executorsJsonTestCases: Array<{
      name: string;
      input: { executors_json: string | null };
      expectedExecutorsCount: number;
      expectedUsername?: string;
    }> = [
      {
        name: "should handle valid executors_json",
        input: {
          executors_json: JSON.stringify([
            {
              id: "executor-1",
              user_id: TEST_CONSTANTS.EXECUTOR_USER_ID,
              user_image: "https://example.com/executor.jpg",
              username: "実行者1",
              rating: 4.5,
            },
          ]),
        },
        expectedExecutorsCount: 1,
      },
      {
        name: "should handle null executors_json",
        input: { executors_json: null },
        expectedExecutorsCount: 0,
      },
      {
        name: "should handle invalid JSON in executors_json",
        input: { executors_json: "invalid json" },
        expectedExecutorsCount: 0,
      },
      {
        name: "should handle non-array executors_json",
        input: { executors_json: JSON.stringify({ notArray: "data" }) },
        expectedExecutorsCount: 0,
      },
      {
        name: "should handle executors_json with missing username",
        input: {
          executors_json: JSON.stringify([
            {
              id: "executor-1",
              user_id: TEST_CONSTANTS.EXECUTOR_USER_ID,
              user_image: null,
              username: null,
              rating: 4.0,
            },
          ]),
        },
        expectedExecutorsCount: 1,
        expectedUsername: "未設定",
      },
      {
        name: "should handle executors_json with invalid data",
        input: {
          executors_json: JSON.stringify([
            {
              id: "executor-1",
              user_id: TEST_CONSTANTS.EXECUTOR_USER_ID,
              user_image: null,
              username: "有効な実行者",
              rating: 4.0,
            },
            {
              incomplete: "data", // 不完全なデータ
            },
          ]),
        },
        expectedExecutorsCount: 1,
      },
    ];

    test.each(executorsJsonTestCases)(
      "executorsJson_$name",
      async ({ input, expectedExecutorsCount, expectedUsername }) => {
        // Arrange
        const mockData = createMockAuctionData(input);
        const params = createTestParams();
        const mockGroupMemberships = [
          groupMembershipFactory.build({
            userId: TEST_CONSTANTS.USER_ID,
            groupId: TEST_CONSTANTS.GROUP_ID,
          }),
        ];

        prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
        prismaMock.$queryRaw.mockResolvedValueOnce([mockData]).mockResolvedValueOnce([{ count: BigInt(1) }]);

        // Act
        const result = await cachedGetAuctionListingsAndCount(params);

        // Assert
        expect(result.listings).toHaveLength(1);
        expect(Array.isArray(result.listings[0].executors_json)).toBe(true);
        if (Array.isArray(result.listings[0].executors_json)) {
          expect(result.listings[0].executors_json).toHaveLength(expectedExecutorsCount);
          if (expectedUsername && result.listings[0].executors_json.length > 0) {
            expect(result.listings[0].executors_json[0].userSettingsUsername).toBe(expectedUsername);
          }
        }
      },
    );
  });

  describe("正常系 - グループメンバーシップテスト", () => {
    test("should return empty results when user has no group memberships", async () => {
      // Arrange
      const params = createTestParams();
      prismaMock.groupMembership.findMany.mockResolvedValue([]);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should return empty when specified groupIds are not accessible to user", async () => {
      // Arrange
      const inaccessibleGroupId = "inaccessible-group-id";
      const params = createTestParams({ groupIds: [inaccessibleGroupId] });
      const mockGroupMemberships = [
        groupMembershipFactory.build({
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID,
        }),
      ];
      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("should handle mixed accessible and inaccessible groupIds", async () => {
      // Arrange
      const inaccessibleGroupId = "inaccessible-group-id";
      const params = createTestParams({
        groupIds: [TEST_CONSTANTS.GROUP_ID, inaccessibleGroupId],
      });
      setupSuccessfulMocks(2);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe("異常系・エラーハンドリングテスト", () => {
    /**
     * 無効な引数のテストケース
     */
    const invalidParametersTestCases = [
      {
        name: "should handle null listingsConditions",
        input: {
          listingsConditions: null as unknown as AuctionListingsConditions,
          userId: TEST_CONSTANTS.USER_ID,
        },
      },
      {
        name: "should handle undefined userId",
        input: {
          listingsConditions: createTestParams().listingsConditions,
          userId: undefined as unknown as string,
        },
      },
      {
        name: "should handle empty string userId",
        input: {
          listingsConditions: createTestParams().listingsConditions,
          userId: "",
        },
      },
      {
        name: "should handle non-string userId",
        input: {
          listingsConditions: createTestParams().listingsConditions,
          userId: 123 as unknown as string,
        },
      },
    ] as const;

    test.each(invalidParametersTestCases)("invalidParameters_$name", async ({ input }) => {
      // Act
      const result = await cachedGetAuctionListingsAndCount(input as GetAuctionListingsParams);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });

    /**
     * データベースエラーのテストケース
     */
    const databaseErrorTestCases = [
      {
        name: "should handle groupMembership query error",
        setupMock: () => {
          prismaMock.groupMembership.findMany.mockRejectedValue(new Error("Database connection error"));
        },
      },
      {
        name: "should handle auction listings query error",
        setupMock: () => {
          const mockGroupMemberships = [
            groupMembershipFactory.build({
              userId: TEST_CONSTANTS.USER_ID,
              groupId: TEST_CONSTANTS.GROUP_ID,
            }),
          ];
          prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
          prismaMock.$queryRaw
            .mockRejectedValueOnce(new Error("Listings query failed"))
            .mockResolvedValueOnce([{ count: BigInt(0) }]);
        },
      },
      {
        name: "should handle count query error",
        setupMock: () => {
          const mockGroupMemberships = [
            groupMembershipFactory.build({
              userId: TEST_CONSTANTS.USER_ID,
              groupId: TEST_CONSTANTS.GROUP_ID,
            }),
          ];
          prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
          prismaMock.$queryRaw.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("Count query failed"));
        },
      },
      {
        name: "should handle invalid count result structure",
        setupMock: () => {
          const mockGroupMemberships = [
            groupMembershipFactory.build({
              userId: TEST_CONSTANTS.USER_ID,
              groupId: TEST_CONSTANTS.GROUP_ID,
            }),
          ];
          prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
          prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // Empty count result
        },
      },
      {
        name: "should handle undefined count result",
        setupMock: () => {
          const mockGroupMemberships = [
            groupMembershipFactory.build({
              userId: TEST_CONSTANTS.USER_ID,
              groupId: TEST_CONSTANTS.GROUP_ID,
            }),
          ];
          prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
          prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);
        },
      },
    ] as const;

    test.each(databaseErrorTestCases)("databaseError_$name", async ({ setupMock }) => {
      // Arrange
      const params = createTestParams();
      setupMock();

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe("境界値テスト", () => {
    test("should handle maximum safe integer count", async () => {
      // Arrange
      const params = createTestParams();
      const maxCount = Number.MAX_SAFE_INTEGER;
      const mockGroupMemberships = [
        groupMembershipFactory.build({
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID,
        }),
      ];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(maxCount) }]);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(maxCount);
    });

    test("should handle zero page number", async () => {
      // Arrange
      const params = createTestParams({ page: 0 });
      setupSuccessfulMocks(0);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    test("should handle negative page number", async () => {
      // Arrange
      const params = createTestParams({ page: -1 });
      setupSuccessfulMocks(0);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });
});
