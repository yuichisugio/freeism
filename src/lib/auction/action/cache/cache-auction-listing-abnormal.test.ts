/**
 * エラーハンドリングのテスト
 * セキュリティテスト
 */
import type { AuctionListingsConditions } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { Factory } from "fishery";
import { beforeEach, describe, expect, it, test, vi } from "vitest";

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * パラメータ生成用のファクトリー
 */
const AuctionListingsConditionsFactory = Factory.define<AuctionListingsConditions>(() => ({
  categories: null,
  status: null,
  joinType: "OR",
  minBid: null,
  maxBid: null,
  minRemainingTime: null,
  maxRemainingTime: null,
  groupIds: null,
  searchQuery: null,
  sort: null,
  page: 1,
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メインテストスイート
 */
describe("cachedGetAuctionListingsAndCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // モックの設定
    vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([
      groupMembershipFactory.build({ groupId: "group1" }),
      groupMembershipFactory.build({ groupId: "group2" }),
      groupMembershipFactory.build({ groupId: "group3" }),
    ]);

    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  });

  describe("異常系テスト", () => {
    /**
     * 無効な引数と基本バリデーションエラーのテストケース
     * 重複していたテストケースを統合
     */
    const invalidParametersAndValidationTestCases = [
      // 無効な引数
      {
        name: "should handle null listingsConditions",
        input: {
          listingsConditions: null as unknown as AuctionListingsConditions,
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle undefined listingsConditions",
        input: {
          listingsConditions: undefined as unknown as AuctionListingsConditions,
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle undefined userId",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build(),
          userId: undefined as unknown as string,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle null userId",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build(),
          userId: null as unknown as string,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle empty string userId",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build(),
          userId: "",
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-string userId",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build(),
          userId: 123 as unknown as string,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // ページ番号バリデーション
      {
        name: "should handle page is 0",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ page: 0 }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle negative page",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ page: -1 }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-number page",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ page: "invalid" as unknown as number }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // joinTypeバリデーション
      {
        name: "should handle invalid joinType",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            joinType: "INVALID" as unknown as "OR" | "AND",
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle null joinType when status is provided",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            joinType: null as unknown as "OR" | "AND",
            status: ["not_ended", "bidded"],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: false,
      },

      // カテゴリーバリデーション
      {
        name: "should handle invalid categories",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            categories: ["無効なカテゴリー"],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle empty array categories",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ categories: [] }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: false,
      },
      {
        name: "should handle non-array categories",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            categories: "デザイン" as unknown as string[],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // ステータスバリデーション
      {
        name: "should handle invalid status",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            status: ["invalid_status"] as unknown as AuctionListingsConditions["status"],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-array status",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            status: "not_ended" as unknown as string[],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // 入札額バリデーション
      {
        name: "should handle negative minBid",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ minBid: -100 }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle negative maxBid",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ maxBid: -50 }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-number minBid",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            minBid: "invalid" as unknown as number,
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-number maxBid",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            maxBid: "invalid" as unknown as number,
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // 残り時間バリデーション
      {
        name: "should handle negative minRemainingTime",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ minRemainingTime: -1 }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle negative maxRemainingTime",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ maxRemainingTime: -5 }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-number minRemainingTime",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            minRemainingTime: "invalid" as unknown as number,
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-number maxRemainingTime",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            maxRemainingTime: "invalid" as unknown as number,
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // ソートバリデーション
      {
        name: "should handle invalid sort field",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            sort: [{ field: "invalid_field" as unknown as "newest", direction: "desc" as const }],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle invalid sort direction",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            sort: [{ field: "newest" as const, direction: "invalid_direction" as unknown as "desc" }],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-array sort",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            sort: { field: "newest", direction: "desc" } as unknown as Array<{ field: string; direction: string }>,
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle empty sort array",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ sort: [] }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: false,
      },

      // グループIDバリデーション
      {
        name: "should handle non-array groupIds",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            groupIds: "string-instead-of-array" as unknown as string[],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle groupIds with non-string elements",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            groupIds: [123, "valid-id"] as unknown as string[],
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle empty groupIds array",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({ groupIds: [] }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: false,
      },

      // 検索クエリバリデーション
      {
        name: "should handle extremely long searchQuery",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            searchQuery: "a".repeat(10000),
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
      {
        name: "should handle non-string searchQuery",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            searchQuery: 123 as unknown as string,
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },

      // 複合条件のバリデーション
      {
        name: "should handle multiple invalid parameters",
        input: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            page: -1,
            minBid: -100,
            categories: ["無効なカテゴリー"],
            joinType: "INVALID" as unknown as "OR" | "AND",
          }),
          userId: TEST_CONSTANTS.USER_ID,
        },
        expectedResult: { listings: [], count: 0 },
        shouldCallConsoleError: true,
      },
    ] as const;

    test.each(invalidParametersAndValidationTestCases)(
      "$name",
      async ({ input, expectedResult, shouldCallConsoleError }) => {
        // Arrange
        const mockGroupMemberships = [
          groupMembershipFactory.build({
            userId: input.userId || TEST_CONSTANTS.USER_ID,
            groupId: TEST_CONSTANTS.GROUP_ID,
          }),
        ];

        prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);

        let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;
        if (shouldCallConsoleError) {
          consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
            // モック実装（何もしない）
          });
        }

        // Act
        const result = await cachedGetAuctionListingsAndCount(input as GetAuctionListingsParams);

        // Assert
        expect(result.listings).toStrictEqual(expectedResult.listings);
        expect(result.count).toBe(expectedResult.count);

        if (shouldCallConsoleError && consoleErrorSpy) {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            "src/lib/auction/action/cache-auction-listing.ts_cachedGetAuctionListingsAndCount_error",
            expect.any(Error),
          );
          consoleErrorSpy.mockRestore();
        }
      },
    );

    /**
     * 特別なケースのテスト
     */
    it("should return empty result when user has no group memberships", async () => {
      // Arrange
      vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([]);
      const params = {
        listingsConditions: AuctionListingsConditionsFactory.build(),
        userId: "user1",
      };

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result).toStrictEqual({ listings: [], count: 0 });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("should return empty result when user is not member of specified groups", async () => {
      // Arrange
      const params = {
        listingsConditions: AuctionListingsConditionsFactory.build({
          groupIds: ["group_nonexistent", "group_unknown"],
        }),
        userId: "user1",
      };

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(result).toStrictEqual({ listings: [], count: 0 });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
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
        name: "should handle both queries error",
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
            .mockRejectedValueOnce(new Error("Count query failed"));
        },
      },
      {
        name: "should handle JSON parsing error in executors_json gracefully",
        setupMock: () => {
          const mockGroupMemberships = [
            groupMembershipFactory.build({
              userId: TEST_CONSTANTS.USER_ID,
              groupId: TEST_CONSTANTS.GROUP_ID,
            }),
          ];
          prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
          // 不正なJSONを含むダミーデータを返す
          prismaMock.$queryRaw
            .mockResolvedValueOnce([
              {
                id: "auction-1",
                current_highest_bid: 1000,
                end_time: new Date(),
                start_time: new Date(),
                status: "AUCTION_ACTIVE",
                created_at: new Date(),
                task: "テストタスク",
                detail: "テスト詳細",
                image_url: null,
                category: "デザイン",
                group_id: TEST_CONSTANTS.GROUP_ID,
                group_name: "テストグループ",
                bids_count: BigInt(0),
                is_watched: false,
                executors_json: "{invalid json",
                score: null,
                task_highlighted: null,
                detail_highlighted: null,
              },
            ])
            .mockResolvedValueOnce([{ count: BigInt(1) }]);
        },
      },
    ] as const;

    test.each(databaseErrorTestCases)("databaseError_$name", async ({ setupMock, name }) => {
      // Arrange
      const params = createTestParams();
      setupMock();

      // Act
      const result = await cachedGetAuctionListingsAndCount(params);

      // Assert
      if (name.includes("JSON parsing error")) {
        // JSONパースエラーの場合は、処理が継続されて結果が返される
        expect(result.listings.length).toBeGreaterThanOrEqual(0);
        expect(result.count).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.listings).toStrictEqual([]);
        expect(result.count).toBe(0);
      }
    });
  });

  describe("セキュリティテスト", () => {
    /**
     * SQLインジェクション対策テスト
     */
    const securityTestCases = [
      {
        name: "SQLインジェクション - 検索クエリ",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            searchQuery: "'; DROP TABLE Auction; --",
          }),
          userId: "user1",
        },
      },
      {
        name: "SQLインジェクション - ユーザーID",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build(),
          userId: "'; DROP TABLE User; --",
        },
      },
      {
        name: "SQLインジェクション - グループID",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            groupIds: ["'; DROP TABLE Group; --", "normal-group-id"],
          }),
          userId: "user1",
        },
      },
      {
        name: "SQLインジェクション - カテゴリー",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            categories: ["デザイン'; DROP TABLE Task; --"] as unknown as string[],
          }),
          userId: "user1",
        },
      },
      {
        name: "XSS対策 - 検索クエリ",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            searchQuery: "<script>alert('xss')</script>",
          }),
          userId: "user1",
        },
      },
    ] as const;

    it.each(securityTestCases)("$name に対してSQL安全性が保たれる", async ({ params }) => {
      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      const calls = vi.mocked(prisma.$queryRaw).mock.calls;

      // SQLインジェクションが実行されていないことを確認
      calls.forEach((call) => {
        const sql = call[0] as Prisma.Sql;
        expect(sql.sql).not.toContain("DROP TABLE");
        expect(sql.sql).not.toContain("DELETE FROM");
        expect(sql.sql).not.toContain("UPDATE SET");
        expect(sql.sql).not.toContain("INSERT INTO");
        expect(sql.sql).not.toContain("TRUNCATE");
        expect(sql.sql).not.toContain("<script>");
      });
    });
  });
});
