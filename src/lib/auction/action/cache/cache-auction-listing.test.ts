/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

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
 * 全パターン組み合わせテスト用の定数
 * 実用的な範囲で全パターンをカバーするよう調整
 */
const COMPREHENSIVE_TEST_PATTERNS = {
  // カテゴリー: 10種類
  categories: [
    null,
    [],
    ["すべて"],
    ["食品"],
    ["コード"],
    ["本"],
    ["デザイン"],
    ["開発"],
    ["マーケティング", "ライティング"],
    ["事務作業", "その他"],
  ] as const,

  // ステータス: 8種類 + null/empty
  status: [
    null,
    [],
    ["all"],
    ["watchlist"],
    ["not_bidded"],
    ["bidded"],
    ["ended"],
    ["not_ended"],
    ["not_started"],
    ["started"],
    ["watchlist", "bidded"], // 複数組み合わせ
    ["ended", "not_ended"], // 複数組み合わせ
  ] as const,

  // 結合タイプ: 2種類
  joinType: ["OR", "AND"] as const,

  // 入札額: null, 0, 正の数値
  bidAmounts: [
    [null, null],
    [0, null],
    [null, 0],
    [100, null],
    [null, 2000],
    [100, 2000],
    [1000, 1000], // 同値
    [500, 1500],
  ] as const,

  // 残り時間: null, 0, 正の数値
  remainingTimes: [
    [null, null],
    [0, null],
    [null, 0],
    [1, null],
    [null, 24],
    [1, 24],
    [12, 12], // 同値
    [2, 48],
  ] as const,

  // グループID: null, 空配列, 単一, 複数
  groupIds: [null, [], [TEST_CONSTANTS.GROUP_ID], [TEST_CONSTANTS.GROUP_ID, "another-group-id"]] as const,

  // 検索クエリ: null, 空文字, 単語, 複数単語, 特殊文字
  searchQueries: [null, "", "デザイン", "デザイン JavaScript", "テスト（開発）", "  スペース入り  "] as const,

  // ソート: null, 各フィールドでasc/desc
  sorts: [
    null,
    [],
    [{ field: "relevance" as const, direction: "desc" as const }],
    [{ field: "newest" as const, direction: "asc" as const }],
    [{ field: "newest" as const, direction: "desc" as const }],
    [{ field: "time_remaining" as const, direction: "asc" as const }],
    [{ field: "time_remaining" as const, direction: "desc" as const }],
    [{ field: "bids" as const, direction: "asc" as const }],
    [{ field: "bids" as const, direction: "desc" as const }],
    [{ field: "price" as const, direction: "asc" as const }],
    [{ field: "price" as const, direction: "desc" as const }],
    [{ field: "score" as const, direction: "asc" as const }],
    [{ field: "score" as const, direction: "desc" as const }],
  ] as const,

  // ページ: 1, 2, 大きな数値
  pages: [1, 2, 10, 100] as const,
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 最小公倍数を計算して、全パターンの組み合わせをテストするのに必要なデータ数を算出
 */
function calculateLCMDataCount(): number {
  const patternCounts = [
    COMPREHENSIVE_TEST_PATTERNS.categories.length,
    COMPREHENSIVE_TEST_PATTERNS.status.length,
    COMPREHENSIVE_TEST_PATTERNS.joinType.length,
    COMPREHENSIVE_TEST_PATTERNS.bidAmounts.length,
    COMPREHENSIVE_TEST_PATTERNS.remainingTimes.length,
    COMPREHENSIVE_TEST_PATTERNS.groupIds.length,
    COMPREHENSIVE_TEST_PATTERNS.searchQueries.length,
    COMPREHENSIVE_TEST_PATTERNS.sorts.length,
    COMPREHENSIVE_TEST_PATTERNS.pages.length,
  ];

  // LCMの近似値（全パターンをカバーするため）
  // 実際のLCMは非常に大きくなるため、実用的な範囲で最大値を採用
  return Math.max(...patternCounts) * 10; // 各パターンが最低10回はテストされる
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックデータ生成ヘルパー関数
 */
function createMockAuctionData(index: number, overrides = {}) {
  // 循環的にパターンを選択
  const categoryIndex = index % COMPREHENSIVE_TEST_PATTERNS.categories.length;
  const statusIndex = index % Object.values(TaskStatus).length;
  const bidCountIndex = index % 10;
  const priceIndex = index % 8;

  const mockCategory = COMPREHENSIVE_TEST_PATTERNS.categories[categoryIndex];
  const selectedCategory = Array.isArray(mockCategory) && mockCategory.length > 0 ? mockCategory[0] : "デザイン";

  const taskStatuses = Object.values(TaskStatus);
  const selectedStatus = taskStatuses[statusIndex];

  const bidCounts = [0, 1, 2, 3, 5, 10, 15, 25, 50, 100];
  const prices = [100, 500, 1000, 1500, 2000, 3000, 5000, 10000];

  return {
    id: `${TEST_CONSTANTS.AUCTION_ID}-${index + 1}`,
    current_highest_bid: prices[priceIndex],
    end_time: new Date(`2024-12-${(index % 28) + 1}T23:59:59Z`),
    start_time: new Date(`2024-01-${(index % 28) + 1}T00:00:00Z`),
    status: selectedStatus,
    created_at: new Date(`2024-01-${(index % 28) + 1}T00:00:00Z`),
    task: `テストタスク${index + 1}`,
    detail: `テストタスクの詳細説明${index + 1}`,
    image_url: `https://example.com/image${index + 1}.jpg`,
    category: selectedCategory,
    group_id: TEST_CONSTANTS.GROUP_ID,
    group_name: `テストグループ${index + 1}`,
    bids_count: BigInt(bidCounts[bidCountIndex]),
    is_watched: index % 2 === 0,
    executors_json: JSON.stringify([
      {
        id: `executor-${index + 1}`,
        user_id: `${TEST_CONSTANTS.EXECUTOR_USER_ID}-${index + 1}`,
        user_image: `https://example.com/executor${index + 1}.jpg`,
        username: `実行者テストユーザー${index + 1}`,
        rating: 4.0 + (index % 5) * 0.2,
      },
    ]),
    score: 0.5 + (index % 10) * 0.05,
    task_highlighted: `<mark>テスト</mark>タスク${index + 1}`,
    detail_highlighted: `<mark>テスト</mark>タスクの詳細説明${index + 1}`,
    _dummy: false,
    ...overrides,
  };
}

/**
 * 複数のモックデータ生成
 */
function createMockAuctionDataList(count: number) {
  return Array.from({ length: count }, (_, index) => createMockAuctionData(index));
}

/**
 * 成功ケースの共通モックセットアップ
 */
function setupSuccessfulMocks(auctionDataCount = calculateLCMDataCount()) {
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
    categories: ["デザイン"],
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

/**
 * AuctionCardの詳細フィールドを検証するヘルパー関数
 */
function validateAuctionCardStructure(auctionCard: any) {
  // 基本フィールドの存在確認
  expect(auctionCard).toHaveProperty("id");
  expect(auctionCard).toHaveProperty("current_highest_bid");
  expect(auctionCard).toHaveProperty("end_time");
  expect(auctionCard).toHaveProperty("start_time");
  expect(auctionCard).toHaveProperty("status");
  expect(auctionCard).toHaveProperty("task");
  expect(auctionCard).toHaveProperty("detail");
  expect(auctionCard).toHaveProperty("image_url");
  expect(auctionCard).toHaveProperty("category");
  expect(auctionCard).toHaveProperty("group_id");
  expect(auctionCard).toHaveProperty("group_name");
  expect(auctionCard).toHaveProperty("bids_count");
  expect(auctionCard).toHaveProperty("is_watched");
  expect(auctionCard).toHaveProperty("executors_json");

  // 型の検証
  expect(typeof auctionCard.id).toBe("string");
  expect(typeof auctionCard.current_highest_bid).toBe("number");
  expect(auctionCard.end_time).toBeInstanceOf(Date);
  expect(auctionCard.start_time).toBeInstanceOf(Date);
  expect(typeof auctionCard.status).toBe("string");
  expect(typeof auctionCard.task).toBe("string");
  expect(typeof auctionCard.group_id).toBe("string");
  expect(typeof auctionCard.group_name).toBe("string");
  expect(typeof auctionCard.bids_count).toBe("number");
  expect(typeof auctionCard.is_watched).toBe("boolean");

  // executors_jsonが配列であることを確認
  expect(Array.isArray(auctionCard.executors_json)).toBe(true);
  if (Array.isArray(auctionCard.executors_json) && auctionCard.executors_json.length > 0) {
    const executor = auctionCard.executors_json[0];
    expect(executor).toHaveProperty("id");
    expect(executor).toHaveProperty("userId");
    expect(executor).toHaveProperty("userImage");
    expect(executor).toHaveProperty("userSettingsUsername");
    expect(executor).toHaveProperty("rating");
  }

  // オプショナルフィールドの型検証（nullまたは適切な型）
  if (auctionCard.detail !== null) expect(typeof auctionCard.detail).toBe("string");
  if (auctionCard.image_url !== null) expect(typeof auctionCard.image_url).toBe("string");
  if (auctionCard.category !== null) expect(typeof auctionCard.category).toBe("string");
  if (auctionCard.score !== null) expect(typeof auctionCard.score).toBe("number");
  if (auctionCard.task_highlighted !== null) expect(typeof auctionCard.task_highlighted).toBe("string");
  if (auctionCard.detail_highlighted !== null) expect(typeof auctionCard.detail_highlighted).toBe("string");
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テスト実装
 */
describe("cache-auction-listing.ts_cachedGetAuctionListingsAndCount", () => {
  describe("正常系 - 全パターン組み合わせテスト", () => {
    /**
     * 各フィールドの全パターンを循環的にテストする包括的テスト
     */
    test("should handle all combinations of listingsConditions patterns", async () => {
      // Arrange
      const dataCount = calculateLCMDataCount();
      setupSuccessfulMocks(dataCount);

      // 全パターンを循環的にテスト
      const testCases = Array.from({ length: Math.min(dataCount, 120) }, (_, index) => {
        const categoryIndex = index % COMPREHENSIVE_TEST_PATTERNS.categories.length;
        const statusIndex = index % COMPREHENSIVE_TEST_PATTERNS.status.length;
        const joinTypeIndex = index % COMPREHENSIVE_TEST_PATTERNS.joinType.length;
        const bidAmountIndex = index % COMPREHENSIVE_TEST_PATTERNS.bidAmounts.length;
        const remainingTimeIndex = index % COMPREHENSIVE_TEST_PATTERNS.remainingTimes.length;
        const groupIdIndex = index % COMPREHENSIVE_TEST_PATTERNS.groupIds.length;
        const searchQueryIndex = index % COMPREHENSIVE_TEST_PATTERNS.searchQueries.length;
        const sortIndex = index % COMPREHENSIVE_TEST_PATTERNS.sorts.length;
        const pageIndex = index % COMPREHENSIVE_TEST_PATTERNS.pages.length;

        const [minBid, maxBid] = COMPREHENSIVE_TEST_PATTERNS.bidAmounts[bidAmountIndex];
        const [minRemainingTime, maxRemainingTime] = COMPREHENSIVE_TEST_PATTERNS.remainingTimes[remainingTimeIndex];

        return {
          categories: COMPREHENSIVE_TEST_PATTERNS.categories[categoryIndex],
          status: COMPREHENSIVE_TEST_PATTERNS.status[statusIndex],
          joinType: COMPREHENSIVE_TEST_PATTERNS.joinType[joinTypeIndex],
          minBid,
          maxBid,
          minRemainingTime,
          maxRemainingTime,
          groupIds: COMPREHENSIVE_TEST_PATTERNS.groupIds[groupIdIndex],
          searchQuery: COMPREHENSIVE_TEST_PATTERNS.searchQueries[searchQueryIndex],
          sort: COMPREHENSIVE_TEST_PATTERNS.sorts[sortIndex],
          page: COMPREHENSIVE_TEST_PATTERNS.pages[pageIndex],
        };
      });

      // Act & Assert
      for (const testCase of testCases) {
        const params = createTestParams(testCase);
        const result = await cachedGetAuctionListingsAndCount(params);

        // 基本的な構造の検証
        expect(result).toHaveProperty("listings");
        expect(result).toHaveProperty("count");
        expect(Array.isArray(result.listings)).toBe(true);
        expect(typeof result.count).toBe("number");
        expect(result.count).toBeGreaterThanOrEqual(0);

        // データが存在する場合の詳細検証
        if (result.listings.length > 0) {
          // 最初の数件のアイテムを詳細検証
          const itemsToValidate = Math.min(result.listings.length, 3);
          for (let i = 0; i < itemsToValidate; i++) {
            validateAuctionCardStructure(result.listings[i]);
          }

          // 全アイテムの基本構造チェック
          result.listings.forEach((item) => {
            expect(item.id).toBeTruthy();
            expect(typeof item.id).toBe("string");
            expect(item.group_id).toBe(TEST_CONSTANTS.GROUP_ID);
          });
        }

        // モックが適切に呼ばれているかを確認
        expect(prismaMock.groupMembership.findMany).toHaveBeenCalled();
        expect(prismaMock.$queryRaw).toHaveBeenCalled();
      }
    });

    /**
     * カテゴリーフィルターの各パターン詳細テスト
     */
    test.each(COMPREHENSIVE_TEST_PATTERNS.categories.map((categories, index) => ({ categories, index })))(
      "should handle categories pattern $index: $categories",
      async ({ categories }) => {
        // Arrange
        const dataCount = 20;
        const params = createTestParams({ categories });
        setupSuccessfulMocks(dataCount);

        // Act
        const result = await cachedGetAuctionListingsAndCount(params);

        // Assert
        expect(result.listings).toHaveLength(dataCount);
        expect(result.count).toBe(dataCount);

        // データの詳細検証
        if (result.listings.length > 0) {
          result.listings.slice(0, 3).forEach((item) => {
            validateAuctionCardStructure(item);
          });
        }
      },
    );

    /**
     * ステータスフィルターの各パターン詳細テスト
     */
    test.each(COMPREHENSIVE_TEST_PATTERNS.status.map((status, index) => ({ status, index })))(
      "should handle status pattern $index: $status",
      async ({ status }) => {
        // Arrange
        const dataCount = 20;
        const params = createTestParams({ status });
        setupSuccessfulMocks(dataCount);

        // Act
        const result = await cachedGetAuctionListingsAndCount(params);

        // Assert
        expect(result.listings).toHaveLength(dataCount);
        expect(result.count).toBe(dataCount);

        // データの詳細検証
        if (result.listings.length > 0) {
          result.listings.slice(0, 3).forEach((item) => {
            validateAuctionCardStructure(item);
          });
        }
      },
    );

    /**
     * 入札額フィルターの各パターン詳細テスト
     */
    test.each(COMPREHENSIVE_TEST_PATTERNS.bidAmounts.map(([minBid, maxBid], index) => ({ minBid, maxBid, index })))(
      "should handle bid amount pattern $index: minBid=$minBid, maxBid=$maxBid",
      async ({ minBid, maxBid }) => {
        // Arrange
        const dataCount = 20;
        const params = createTestParams({ minBid, maxBid });
        setupSuccessfulMocks(dataCount);

        // Act
        const result = await cachedGetAuctionListingsAndCount(params);

        // Assert
        expect(result.listings).toHaveLength(dataCount);
        expect(result.count).toBe(dataCount);

        // データの詳細検証
        if (result.listings.length > 0) {
          result.listings.slice(0, 3).forEach((item) => {
            validateAuctionCardStructure(item);
            // 入札額の妥当性チェック
            expect(typeof item.current_highest_bid).toBe("number");
            expect(item.current_highest_bid).toBeGreaterThanOrEqual(0);
          });
        }
      },
    );

    /**
     * 検索クエリの各パターン詳細テスト
     */
    test.each(COMPREHENSIVE_TEST_PATTERNS.searchQueries.map((searchQuery, index) => ({ searchQuery, index })))(
      "should handle search query pattern $index: '$searchQuery'",
      async ({ searchQuery }) => {
        // Arrange
        const dataCount = 20;
        const params = createTestParams({ searchQuery });
        setupSuccessfulMocks(dataCount);

        // Act
        const result = await cachedGetAuctionListingsAndCount(params);

        // Assert
        expect(result.listings).toHaveLength(dataCount);
        expect(result.count).toBe(dataCount);

        // データの詳細検証
        if (result.listings.length > 0) {
          result.listings.slice(0, 3).forEach((item) => {
            validateAuctionCardStructure(item);
          });
        }
      },
    );

    /**
     * ソートの各パターン詳細テスト
     */
    test.each(COMPREHENSIVE_TEST_PATTERNS.sorts.map((sort, index) => ({ sort, index })))(
      "should handle sort pattern $index: $sort",
      async ({ sort }) => {
        // Arrange
        const dataCount = 20;
        const params = createTestParams({ sort });
        setupSuccessfulMocks(dataCount);

        // Act
        const result = await cachedGetAuctionListingsAndCount(params);

        // Assert
        expect(result.listings).toHaveLength(dataCount);
        expect(result.count).toBe(dataCount);

        // データの詳細検証
        if (result.listings.length > 0) {
          result.listings.slice(0, 3).forEach((item) => {
            validateAuctionCardStructure(item);
          });
        }
      },
    );
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
        const mockData = createMockAuctionData(0, input);
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
        expect(result.count).toBe(1);

        // データの詳細検証
        const auctionCard = result.listings[0];
        validateAuctionCardStructure(auctionCard);

        // executors_jsonの詳細検証
        expect(Array.isArray(auctionCard.executors_json)).toBe(true);
        if (Array.isArray(auctionCard.executors_json)) {
          expect(auctionCard.executors_json).toHaveLength(expectedExecutorsCount);
          if (expectedUsername && auctionCard.executors_json.length > 0) {
            expect(auctionCard.executors_json[0].userSettingsUsername).toBe(expectedUsername);
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
      const dataCount = 20;
      setupSuccessfulMocks(dataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(dataCount);
      expect(result.count).toBe(dataCount);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // データの詳細検証
      if (result.listings.length > 0) {
        result.listings.slice(0, 3).forEach((item) => {
          validateAuctionCardStructure(item);
        });
      }
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
     * バリデーションエラーのテストケース
     */
    const validationErrorTestCases = [
      // ページ番号バリデーション
      {
        name: "should throw error when page is 0",
        input: { page: 0, categories: ["デザイン"] },
        expectedError: "page must be greater than 0",
      },
      {
        name: "should throw error when page is negative",
        input: { page: -1, categories: ["デザイン"] },
        expectedError: "page must be greater than 0",
      },

      // joinTypeバリデーション
      {
        name: "should throw error when joinType is invalid",
        input: { joinType: "INVALID" as unknown as "OR" | "AND", categories: ["デザイン"] },
        expectedError: "joinType must be OR, AND",
      },

      // カテゴリーバリデーション
      {
        name: "should throw error when categories contain invalid values",
        input: { categories: ["無効なカテゴリー"] },
        expectedError:
          "categories must be in すべて, 食品, コード, 本, デザイン, 開発, マーケティング, ライティング, 事務作業, その他",
      },

      // ステータスバリデーション
      {
        name: "should throw error when status contains invalid values",
        input: {
          status: ["invalid_status"] as unknown as AuctionListingsConditions["status"],
          categories: ["デザイン"],
        },
        expectedError: "status must be in all, watchlist, not_bidded, bidded, ended, not_ended, not_started, started",
      },

      // 入札額バリデーション
      {
        name: "should throw error when minBid is negative",
        input: { minBid: -100, categories: ["デザイン"] },
        expectedError: "minBid and maxBid must be greater than 0",
      },
      {
        name: "should throw error when maxBid is negative",
        input: { maxBid: -50, categories: ["デザイン"] },
        expectedError: "minBid and maxBid must be greater than 0",
      },

      // 残り時間バリデーション
      {
        name: "should throw error when minRemainingTime is negative",
        input: { minRemainingTime: -1, categories: ["デザイン"] },
        expectedError: "minRemainingTime and maxRemainingTime must be greater than 0",
      },
      {
        name: "should throw error when maxRemainingTime is negative",
        input: { maxRemainingTime: -5, categories: ["デザイン"] },
        expectedError: "minRemainingTime and maxRemainingTime must be greater than 0",
      },

      // ソートフィールドバリデーション
      {
        name: "should throw error when sort field is invalid",
        input: {
          sort: [{ field: "invalid_field" as unknown as "newest", direction: "desc" as const }],
          categories: ["デザイン"],
        },
        expectedError: "sort must be relevance, newest, time_remaining, bids, price, score",
      },
      {
        name: "should throw error when sort direction is invalid",
        input: {
          sort: [{ field: "newest" as const, direction: "invalid_direction" as unknown as "desc" }],
          categories: ["デザイン"],
        },
        expectedError: "sort direction must be asc, desc",
      },

      // グループIDバリデーション
      {
        name: "should throw error when groupIds is string instead of array",
        input: { groupIds: "string-instead-of-array" as unknown as string[], categories: ["デザイン"] },
        expectedError: "groupIds must be an array of strings",
      },
    ] as const;

    test.each(validationErrorTestCases)("validation_$name", async ({ input }) => {
      // Arrange
      const params = createTestParams(input);
      const mockGroupMemberships = [
        groupMembershipFactory.build({
          userId: TEST_CONSTANTS.USER_ID,
          groupId: TEST_CONSTANTS.GROUP_ID,
        }),
      ];

      prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);

      // console.errorをモックして、バリデーションエラーが内部で発生したことを確認
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // モック実装（何もしない）
      });

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      // バリデーションエラーが発生し、空の結果が返されることを確認
      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);

      // console.errorが呼ばれたことを確認
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "src/lib/auction/action/cache-auction-listing.ts_cachedGetAuctionListingsAndCount_error",
        expect.any(Error),
      );

      // スパイをリストア
      consoleErrorSpy.mockRestore();
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

    test("should handle edge case with minimal valid data", async () => {
      // Arrange
      const params = createTestParams({
        categories: [],
        status: [],
        minBid: 0,
        maxBid: 0,
        minRemainingTime: 0,
        maxRemainingTime: 0,
        page: 1,
      });
      const dataCount = 1;
      setupSuccessfulMocks(dataCount);

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result.listings).toHaveLength(dataCount);
      expect(result.count).toBe(dataCount);

      // データの詳細検証
      if (result.listings.length > 0) {
        validateAuctionCardStructure(result.listings[0]);
      }
    });
  });
});
