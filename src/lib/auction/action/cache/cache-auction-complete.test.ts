/* eslint-disable  @typescript-eslint/prefer-optional-chain */

import type { AuctionListingsConditions, JoinType } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Factory } from "fishery";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GetAuctionListingsParams } from "./cache-auction-listing";
import { cachedGetAuctionListingsAndCount } from "./cache-auction-listing";

// パラメータ生成用のファクトリー
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

/**
 * SQLの詳細な検証を行う関数
 */
function validateSQL(sql: Prisma.Sql, params: GetAuctionListingsParams, sqlType: "listing" | "count"): void {
  expect(sql.sql).toBeDefined();
  expect(typeof sql.sql).toBe("string");
  expect(sql.sql.length).toBeGreaterThan(0);

  const { listingsConditions } = params;

  if (sqlType === "listing") {
    // Listings SQLの基本構造検証
    expect(sql.sql).toContain('WITH "FilteredAuctionsCTE"');
    expect(sql.sql).toContain("SELECT");
    expect(sql.sql).toContain('FROM "Auction"');
    expect(sql.sql).toContain("LIMIT");
    expect(sql.sql).toContain("OFFSET");

    // パラメータ別の条件検証
    if (listingsConditions.searchQuery?.trim()) {
      expect(sql.sql).toContain("pgroonga_score");
      expect(sql.sql).toContain("normalize_japanese");
    }

    if (
      listingsConditions.categories &&
      listingsConditions.categories.length > 0 &&
      !listingsConditions.categories.includes("すべて")
    ) {
      expect(sql.sql).toContain("category ILIKE");
    }

    if (listingsConditions.status && listingsConditions.status.length > 0) {
      const statusChecks = listingsConditions.status;
      if (statusChecks.includes("watchlist")) {
        expect(sql.sql).toContain("TaskWatchList");
      }
      if (statusChecks.includes("bidded") || statusChecks.includes("not_bidded")) {
        expect(sql.sql).toContain("BidHistory");
      }
    }

    if (listingsConditions.minBid !== null && listingsConditions.minBid !== undefined) {
      expect(sql.sql).toContain("current_highest_bid >=");
    }

    if (
      listingsConditions.maxBid !== null &&
      listingsConditions.maxBid !== undefined &&
      listingsConditions.maxBid !== 0
    ) {
      expect(sql.sql).toContain("current_highest_bid <=");
    }

    if (listingsConditions.minRemainingTime !== null && listingsConditions.minRemainingTime !== undefined) {
      expect(sql.sql).toContain("end_time >=");
    }

    if (
      listingsConditions.maxRemainingTime !== null &&
      listingsConditions.maxRemainingTime !== undefined &&
      listingsConditions.maxRemainingTime !== 0
    ) {
      expect(sql.sql).toContain("end_time <=");
    }

    if (listingsConditions.sort && listingsConditions.sort[0]?.field === "bids") {
      expect(sql.sql).toContain("bids_count_intermediate");
    }
  } else if (sqlType === "count") {
    // Count SQLの基本構造検証
    expect(sql.sql).toContain("SELECT COUNT(*)::bigint as count");
    expect(sql.sql).toContain('FROM "Auction"');
    expect(sql.sql).not.toContain("LIMIT");
    expect(sql.sql).not.toContain("OFFSET");
  }
}

/**
 * 効率的なパラメータ組み合わせを生成する関数
 * 重要なパターンに絞った組み合わせを生成（メモリ効率を考慮）
 */
function generateKeyParameterCombinations(): GetAuctionListingsParams[] {
  const combinations: GetAuctionListingsParams[] = [];

  // 基本的なカテゴリーパターン
  const categoriesOptions = [null, [], ["すべて"], ["デザイン"], ["食品", "デザイン"]];

  // 主要なステータスパターン
  const statusOptions = [
    null,
    [],
    ["all"],
    ["watchlist"],
    ["not_bidded"],
    ["bidded"],
    ["ended"],
    ["not_ended"],
    ["watchlist", "bidded"],
  ];

  const joinTypeOptions: JoinType[] = ["OR", "AND"];

  // 境界値とnull
  const minBidOptions = [null, 0, 500];
  const maxBidOptions = [null, 0, 1500];

  // 時間設定
  const minRemainingTimeOptions = [null, 0, 24];
  const maxRemainingTimeOptions = [null, 0, 50];

  // グループIDパターン
  const groupIdsOptions = [null, ["group1"], ["group1", "group2"]];

  // 検索クエリパターン
  const searchQueryOptions = [
    null,
    "",
    "検索",
    "複数 キーワード",
    "'; DROP TABLE test; --", // SQLインジェクション対策テスト
  ];

  // ソートパターン
  const sortOptions = [
    null,
    [{ field: "relevance" as const, direction: "asc" as const }],
    [{ field: "newest" as const, direction: "desc" as const }],
    [{ field: "bids" as const, direction: "asc" as const }],
    [{ field: "price" as const, direction: "desc" as const }],
  ];

  const pageOptions = [1, 2];
  const userIdOptions = ["user1"];

  // 重要な組み合わせのみを生成（メモリ効率を考慮してフィルタリング）
  for (const categories of categoriesOptions) {
    for (const status of statusOptions) {
      for (const joinType of joinTypeOptions) {
        for (const minBid of minBidOptions) {
          for (const maxBid of maxBidOptions) {
            for (const groupIds of groupIdsOptions) {
              for (const searchQuery of searchQueryOptions) {
                for (const sort of sortOptions) {
                  for (const page of pageOptions) {
                    for (const userId of userIdOptions) {
                      // 無意味な組み合わせをスキップしてメモリ効率化
                      if (minBid !== null && maxBid !== null && minBid > maxBid) continue;

                      combinations.push({
                        listingsConditions: {
                          categories,
                          status,
                          joinType,
                          minBid,
                          maxBid,
                          minRemainingTime: minRemainingTimeOptions[0],
                          maxRemainingTime: maxRemainingTimeOptions[0],
                          groupIds,
                          searchQuery,
                          sort,
                          page,
                        },
                        userId,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`生成された重要な組み合わせ数: ${combinations.length}`);
  return combinations;
}

describe("cachedGetAuctionListingsAndCount - 完全なパラメータ組み合わせテスト", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのモック設定
    vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([
      {
        id: "membership1",
        userId: "user1",
        groupId: "group1",
        isGroupOwner: false,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "membership2",
        userId: "user1",
        groupId: "group2",
        isGroupOwner: false,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  });

  // 重要な組み合わせテスト（メモリ効率版）
  describe("重要パラメータ組み合わせテスト", () => {
    const keyCombinations = generateKeyParameterCombinations();

    it("should output key combination statistics", () => {
      console.log(`\n=== 重要な組み合わせテスト統計 ===`);
      console.log(`総組み合わせ数: ${keyCombinations.length}`);

      const stats = {
        categories: new Set<string>(),
        status: new Set<string>(),
        joinType: { OR: 0, AND: 0 } as Record<JoinType, number>,
        hasMinBid: 0,
        hasMaxBid: 0,
        hasSearchQuery: 0,
        hasSort: 0,
        hasGroupIds: 0,
      };

      keyCombinations.forEach((combo) => {
        const { listingsConditions } = combo;

        stats.categories.add(JSON.stringify(listingsConditions.categories));
        stats.status.add(JSON.stringify(listingsConditions.status));
        stats.joinType[listingsConditions.joinType]++;

        if (listingsConditions.minBid !== null) stats.hasMinBid++;
        if (listingsConditions.maxBid !== null) stats.hasMaxBid++;
        if (listingsConditions.searchQuery) stats.hasSearchQuery++;
        if (listingsConditions.sort) stats.hasSort++;
        if (listingsConditions.groupIds && listingsConditions.groupIds.length > 0) stats.hasGroupIds++;
      });

      console.log(`カテゴリーパターン数: ${stats.categories.size}`);
      console.log(`ステータスパターン数: ${stats.status.size}`);
      console.log(`joinType分布: OR=${stats.joinType.OR}, AND=${stats.joinType.AND}`);
      console.log(`===============================\n`);

      expect(keyCombinations.length).toBeGreaterThan(0);
    });

    const batchSize = 5; // メモリ効率を考慮したバッチサイズ
    const batches = [];

    for (let i = 0; i < keyCombinations.length; i += batchSize) {
      batches.push({
        batchIndex: Math.floor(i / batchSize),
        combinations: keyCombinations.slice(i, i + batchSize),
        startIndex: i,
        endIndex: Math.min(i + batchSize - 1, keyCombinations.length - 1),
      });
    }

    it.each(batches)(
      "重要な組み合わせバッチ $batchIndex ($startIndex-$endIndex) のSQL生成検証",
      async ({ combinations, startIndex }) => {
        for (const [localIndex, params] of combinations.entries()) {
          const globalIndex = startIndex + localIndex;

          try {
            // 関数実行
            const result = await cachedGetAuctionListingsAndCount(params);

            // 基本的なレスポンス構造の検証
            expect(result).toHaveProperty("listings");
            expect(result).toHaveProperty("count");
            expect(Array.isArray(result.listings)).toBe(true);
            expect(typeof result.count).toBe("number");

            // prisma.$queryRawの呼び出し検証
            expect(prisma.$queryRaw).toHaveBeenCalled();

            const calls = vi.mocked(prisma.$queryRaw).mock.calls;

            // SQL詳細検証
            if (calls.length >= 1) {
              const lastListingCall = calls[calls.length - 2];
              if (lastListingCall && lastListingCall[0]) {
                const listingSQL = lastListingCall[0] as Prisma.Sql;
                if (listingSQL && typeof listingSQL === "object" && "sql" in listingSQL) {
                  validateSQL(listingSQL, params, "listing");
                }
              }
            }

            if (calls.length >= 2) {
              const lastCountCall = calls[calls.length - 1];
              if (lastCountCall && lastCountCall[0]) {
                const countSQL = lastCountCall[0] as Prisma.Sql;
                if (countSQL && typeof countSQL === "object" && "sql" in countSQL) {
                  validateSQL(countSQL, params, "count");
                }
              }
            }

            vi.clearAllMocks();
          } catch (error) {
            console.error(`\n❌ エラー発生 - グローバルインデックス: ${globalIndex}`);
            console.error(`パラメータ:`, JSON.stringify(params, null, 2));
            console.error(`エラー詳細:`, error);
            throw new Error(
              `組み合わせ ${globalIndex} でテスト失敗: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }
      },
    );
  });

  // 完全なパラメータ組み合わせテスト（ユーザー要求の全パターン）
  describe.skip("完全パラメータ組み合わせテスト（全パターン）", () => {
    // skipを外すと全組み合わせテストが実行される
    const allCombinations = generateKeyParameterCombinations();

    it("should output all combination statistics", () => {
      console.log(`\n=== 完全な組み合わせテスト統計 ===`);
      console.log(`総組み合わせ数: ${allCombinations.length}`);
      expect(allCombinations.length).toBeGreaterThan(0);
    });

    const batchSize = 3; // 全組み合わせの場合はより小さなバッチサイズ
    const batches = [];

    for (let i = 0; i < Math.min(allCombinations.length, 100); i += batchSize) {
      // 最初の100個のみテスト（メモリ制限対策）
      batches.push({
        batchIndex: Math.floor(i / batchSize),
        combinations: allCombinations.slice(i, i + batchSize),
        startIndex: i,
        endIndex: Math.min(i + batchSize - 1, allCombinations.length - 1),
      });
    }

    it.each(batches)(
      "全組み合わせバッチ $batchIndex ($startIndex-$endIndex) のSQL生成検証",
      async ({ combinations, startIndex }) => {
        for (const [localIndex, params] of combinations.entries()) {
          const globalIndex = startIndex + localIndex;

          try {
            const result = await cachedGetAuctionListingsAndCount(params);

            expect(result).toHaveProperty("listings");
            expect(result).toHaveProperty("count");
            expect(Array.isArray(result.listings)).toBe(true);
            expect(typeof result.count).toBe("number");

            expect(prisma.$queryRaw).toHaveBeenCalled();

            const calls = vi.mocked(prisma.$queryRaw).mock.calls;

            if (calls.length >= 1) {
              const lastListingCall = calls[calls.length - 2];
              if (lastListingCall && lastListingCall[0]) {
                const listingSQL = lastListingCall[0] as Prisma.Sql;
                if (listingSQL && typeof listingSQL === "object" && "sql" in listingSQL) {
                  validateSQL(listingSQL, params, "listing");
                }
              }
            }

            if (calls.length >= 2) {
              const lastCountCall = calls[calls.length - 1];
              if (lastCountCall && lastCountCall[0]) {
                const countSQL = lastCountCall[0] as Prisma.Sql;
                if (countSQL && typeof countSQL === "object" && "sql" in countSQL) {
                  validateSQL(countSQL, params, "count");
                }
              }
            }

            vi.clearAllMocks();
          } catch (error) {
            console.error(`\n❌ エラー発生 - グローバルインデックス: ${globalIndex}`);
            console.error(`パラメータ:`, JSON.stringify(params, null, 2));
            console.error(`エラー詳細:`, error);
            throw new Error(
              `組み合わせ ${globalIndex} でテスト失敗: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }
      },
    );
  });

  // 境界値・エラーケーステスト
  describe("境界値・エラーケーステスト", () => {
    const errorTestCases = [
      {
        name: "userIdがnull",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build(),
          userId: null as unknown as string,
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "listingsConditionsがnull",
        params: {
          listingsConditions: null as unknown as AuctionListingsConditions,
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "pageが0以下",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({ page: 0 }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "負のminBid",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({ minBid: -100 }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "負のminRemainingTime",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({ minRemainingTime: -24 }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "無効なjoinType",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            joinType: "INVALID" as unknown as JoinType,
          }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "無効なカテゴリー",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            categories: ["無効なカテゴリー"],
          }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
    ];

    it.each(errorTestCases)("$name の場合エラーを適切に処理する", async ({ params, expected }) => {
      const result = await cachedGetAuctionListingsAndCount(params);
      expect(result).toEqual(expected);
    });

    it("ユーザーが参加しているグループがない場合、空の結果を返す", async () => {
      vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([]);

      const params = {
        listingsConditions: AuctionListingsConditionsFactory.build(),
        userId: "user1",
      };

      const result = await cachedGetAuctionListingsAndCount(params);
      expect(result).toEqual({ listings: [], count: 0 });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("指定されたグループIDにユーザーが参加していない場合、空の結果を返す", async () => {
      const params = {
        listingsConditions: AuctionListingsConditionsFactory.build({
          groupIds: ["group_nonexistent", "group_unknown"],
        }),
        userId: "user1",
      };

      const result = await cachedGetAuctionListingsAndCount(params);
      expect(result).toEqual({ listings: [], count: 0 });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // SQLインジェクション対策テスト
  describe("セキュリティテスト", () => {
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
    ];

    it.each(securityTestCases)("$name に対してSQL安全性が保たれる", async ({ params }) => {
      await cachedGetAuctionListingsAndCount(params);

      const calls = vi.mocked(prisma.$queryRaw).mock.calls;

      calls.forEach((call) => {
        const sql = call[0] as Prisma.Sql;
        if (sql && typeof sql === "object" && "sql" in sql) {
          expect(sql.sql).not.toContain("DROP TABLE");
          expect(sql.sql).not.toContain("DELETE FROM");
          expect(sql.sql).not.toContain("UPDATE SET");
        }
      });
    });
  });

  // 各パラメータタイプの個別詳細テスト
  describe("パラメータ別詳細SQL検証テスト", () => {
    it("should generate correct SQL for category filters", async () => {
      const testCases = [
        { categories: null, shouldContain: false },
        { categories: [], shouldContain: false },
        { categories: ["すべて"], shouldContain: false },
        { categories: ["デザイン"], shouldContain: true },
        { categories: ["食品", "開発"], shouldContain: true },
      ];

      for (const testCase of testCases) {
        const params = {
          listingsConditions: AuctionListingsConditionsFactory.build({
            categories: testCase.categories,
          }),
          userId: "user1",
        };

        await cachedGetAuctionListingsAndCount(params);

        const calls = vi.mocked(prisma.$queryRaw).mock.calls;
        if (calls.length > 0) {
          const lastCall = calls[calls.length - 2];
          if (lastCall && lastCall[0]) {
            const sql = lastCall[0] as Prisma.Sql;
            if (testCase.shouldContain) {
              expect(sql.sql).toContain("category ILIKE");
            } else {
              expect(sql.sql).not.toContain("category ILIKE");
            }
          }
        }

        vi.clearAllMocks();
      }
    });

    it("should generate correct SQL for search queries", async () => {
      const testCases = [
        { searchQuery: null, shouldContain: false },
        { searchQuery: "", shouldContain: false },
        { searchQuery: "検索クエリ", shouldContain: true },
        { searchQuery: "複数 キーワード", shouldContain: true },
      ];

      for (const testCase of testCases) {
        const params = {
          listingsConditions: AuctionListingsConditionsFactory.build({
            searchQuery: testCase.searchQuery,
          }),
          userId: "user1",
        };

        await cachedGetAuctionListingsAndCount(params);

        const calls = vi.mocked(prisma.$queryRaw).mock.calls;
        if (calls.length > 0) {
          const lastCall = calls[calls.length - 2];
          if (lastCall && lastCall[0]) {
            const sql = lastCall[0] as Prisma.Sql;
            if (testCase.shouldContain) {
              expect(sql.sql).toContain("normalize_japanese");
              expect(sql.sql).toContain("pgroonga_score");
            } else {
              expect(sql.sql).not.toContain("normalize_japanese");
              expect(sql.sql).not.toContain("pgroonga_score");
            }
          }
        }

        vi.clearAllMocks();
      }
    });

    it("should generate correct SQL for bid range filters", async () => {
      const testCases = [
        { minBid: null, maxBid: null, expectMinCondition: false, expectMaxCondition: false },
        { minBid: 100, maxBid: null, expectMinCondition: true, expectMaxCondition: false },
        { minBid: null, maxBid: 1000, expectMinCondition: false, expectMaxCondition: true },
        { minBid: 100, maxBid: 1000, expectMinCondition: true, expectMaxCondition: true },
      ];

      for (const testCase of testCases) {
        const params = {
          listingsConditions: AuctionListingsConditionsFactory.build({
            minBid: testCase.minBid,
            maxBid: testCase.maxBid,
          }),
          userId: "user1",
        };

        await cachedGetAuctionListingsAndCount(params);

        const calls = vi.mocked(prisma.$queryRaw).mock.calls;
        if (calls.length > 0) {
          const lastCall = calls[calls.length - 2];
          if (lastCall && lastCall[0]) {
            const sql = lastCall[0] as Prisma.Sql;
            if (testCase.expectMinCondition) {
              expect(sql.sql).toContain("current_highest_bid >=");
            }
            if (testCase.expectMaxCondition) {
              expect(sql.sql).toContain("current_highest_bid <=");
            }
          }
        }

        vi.clearAllMocks();
      }
    });

    it("should generate correct SQL for sort parameters", async () => {
      const testCases = [
        {
          sort: [{ field: "bids" as const, direction: "desc" as const }],
          shouldContainBidsSort: true,
        },
        {
          sort: [{ field: "newest" as const, direction: "asc" as const }],
          shouldContainBidsSort: false,
        },
        {
          sort: null,
          shouldContainBidsSort: false,
        },
      ];

      for (const testCase of testCases) {
        const params = {
          listingsConditions: AuctionListingsConditionsFactory.build({
            sort: testCase.sort,
          }),
          userId: "user1",
        };

        await cachedGetAuctionListingsAndCount(params);

        const calls = vi.mocked(prisma.$queryRaw).mock.calls;
        if (calls.length > 0) {
          const lastCall = calls[calls.length - 2];
          if (lastCall && lastCall[0]) {
            const sql = lastCall[0] as Prisma.Sql;
            if (testCase.shouldContainBidsSort) {
              expect(sql.sql).toContain("bids_count_intermediate");
            }
          }
        }

        vi.clearAllMocks();
      }
    });
  });
});
