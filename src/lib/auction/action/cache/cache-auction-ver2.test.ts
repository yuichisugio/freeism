/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { AuctionListingsConditions } from "@/types/auction-types";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { type Prisma } from "@prisma/client";
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
 * 効率的なパラメータ組み合わせを生成する関数
 * メモリ効率を考慮し、代表的なテストケースに絞る
 */
function generateEfficientParameterCombinations(): GetAuctionListingsParams[] {
  const combinations: GetAuctionListingsParams[] = [];

  // 基本的なテストケース群
  const basicTestCases = [
    // デフォルト設定
    {
      categories: null,
      status: null,
      joinType: "OR" as const,
      minBid: null,
      maxBid: null,
      minRemainingTime: null,
      maxRemainingTime: null,
      groupIds: null,
      searchQuery: null,
      sort: null,
      page: 1,
    },
    // 全フィルター適用
    {
      categories: ["食品", "開発"],
      status: ["watchlist", "bidded"],
      joinType: "AND" as const,
      minBid: 100,
      maxBid: 5000,
      minRemainingTime: 6,
      maxRemainingTime: 48,
      groupIds: ["group1", "group2"],
      searchQuery: "テスト 検索",
      sort: [{ field: "price" as const, direction: "desc" as const }],
      page: 2,
    },
    // 境界値テスト
    {
      categories: [],
      status: [],
      joinType: "OR" as const,
      minBid: 0,
      maxBid: 0,
      minRemainingTime: 0,
      maxRemainingTime: 0,
      groupIds: [],
      searchQuery: "",
      sort: [{ field: "relevance" as const, direction: "asc" as const }],
      page: 1,
    },
    // 高ページ番号
    {
      categories: ["すべて"],
      status: ["all"],
      joinType: "OR" as const,
      minBid: null,
      maxBid: null,
      minRemainingTime: null,
      maxRemainingTime: null,
      groupIds: null,
      searchQuery: null,
      sort: [{ field: "newest" as const, direction: "desc" as const }],
      page: 100,
    },
    // セキュリティテスト用
    {
      categories: null,
      status: null,
      joinType: "OR" as const,
      minBid: null,
      maxBid: null,
      minRemainingTime: null,
      maxRemainingTime: null,
      groupIds: null,
      searchQuery: "'; DROP TABLE test; --",
      sort: null,
      page: 1,
    },
  ];

  // カテゴリー別テストケース
  const categoryTestCases = AUCTION_CONSTANTS.AUCTION_CATEGORIES.slice(0, 3).map((category) => ({
    categories: [category],
    status: null,
    joinType: "OR" as const,
    minBid: null,
    maxBid: null,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: null,
    searchQuery: null,
    sort: null,
    page: 1,
  }));

  // ステータス別テストケース
  const statusTestCases = [["watchlist"], ["not_bidded"], ["bidded"], ["ended"], ["not_ended"]].map((status) => ({
    categories: null,
    status,
    joinType: "OR" as const,
    minBid: null,
    maxBid: null,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: null,
    searchQuery: null,
    sort: null,
    page: 1,
  }));

  // ソート別テストケース
  const sortTestCases = [
    [{ field: "relevance" as const, direction: "asc" as const }],
    [{ field: "newest" as const, direction: "desc" as const }],
    [{ field: "time_remaining" as const, direction: "asc" as const }],
    [{ field: "bids" as const, direction: "desc" as const }],
    [{ field: "price" as const, direction: "asc" as const }],
  ].map((sort) => ({
    categories: null,
    status: null,
    joinType: "OR" as const,
    minBid: null,
    maxBid: null,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: null,
    searchQuery: null,
    sort,
    page: 1,
  }));

  // 価格範囲テストケース
  const priceTestCases = [
    { minBid: 100, maxBid: 1000 },
    { minBid: 0, maxBid: 500 },
    { minBid: 1000, maxBid: 10000 },
  ].map(({ minBid, maxBid }) => ({
    categories: null,
    status: null,
    joinType: "OR" as const,
    minBid,
    maxBid,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: null,
    searchQuery: null,
    sort: null,
    page: 1,
  }));

  // 時間範囲テストケース
  const timeTestCases = [
    { minRemainingTime: 6, maxRemainingTime: 24 },
    { minRemainingTime: 0, maxRemainingTime: 12 },
    { minRemainingTime: 24, maxRemainingTime: 72 },
  ].map(({ minRemainingTime, maxRemainingTime }) => ({
    categories: null,
    status: null,
    joinType: "OR" as const,
    minBid: null,
    maxBid: null,
    minRemainingTime: minRemainingTime,
    maxRemainingTime: maxRemainingTime,
    groupIds: null,
    searchQuery: null,
    sort: null,
    page: 1,
  }));

  // 検索クエリテストケース
  const searchTestCases = [
    "検索",
    "複数 キーワード",
    "英語 english test",
    "特殊文字!@#$%^&*()",
    "OR 1=1 --", // SQLインジェクション対策テスト
  ].map((searchQuery) => ({
    categories: null,
    status: null,
    joinType: "OR" as const,
    minBid: null,
    maxBid: null,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: null,
    searchQuery,
    sort: null,
    page: 1,
  }));

  // 全テストケースを結合
  const allTestConditions = [
    ...basicTestCases,
    ...categoryTestCases,
    ...statusTestCases,
    ...sortTestCases,
    ...priceTestCases,
    ...timeTestCases,
    ...searchTestCases,
  ];

  // ユーザーIDとの組み合わせ（効率的に）
  const userIds = ["user1", "user2", "testuser123"];

  allTestConditions.forEach((listingsConditions) => {
    userIds.forEach((userId) => {
      combinations.push({
        listingsConditions,
        userId,
      });
    });
  });

  console.log(`効率化後の組み合わせ数: ${combinations.length}`);
  return combinations;
}

/**
 * SQLを正規化して比較しやすくする関数
 */
function normalizeSQL(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s*<\s*/g, " < ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .trim();
}

/**
 * SQLの詳細な検証を行う関数
 */
function validateSQL(sql: Prisma.Sql, params: GetAuctionListingsParams, sqlType: "listing" | "count"): void {
  expect(sql.sql).toBeDefined();
  expect(typeof sql.sql).toBe("string");
  expect(sql.sql.length).toBeGreaterThan(0);

  const { listingsConditions } = params;

  // 基本的なSQL構造の検証
  if (sqlType === "listing") {
    expect(sql.sql).toContain("SELECT");
    expect(sql.sql).toContain("FROM");
  } else {
    expect(sql.sql).toContain("COUNT");
  }

  // パラメータに応じた条件の検証
  if (listingsConditions.categories && listingsConditions.categories.length > 0) {
    expect(sql.sql).toContain("category");
  }

  if (listingsConditions.status && listingsConditions.status.length > 0) {
    // ステータス関連のチェック
    expect(sql.sql.toLowerCase()).toMatch(/where|and|or/);
  }

  if (listingsConditions.minBid !== null || listingsConditions.maxBid !== null) {
    expect(sql.sql).toContain("current_highest_bid");
  }

  if (listingsConditions.searchQuery) {
    expect(sql.sql).toContain("&@~");
  }

  // SQLインジェクション対策の検証
  expect(sql.sql).not.toContain("DROP TABLE");
  expect(sql.sql).not.toContain("DELETE FROM");
  expect(sql.sql).not.toContain("UPDATE SET");
}

// メインテストスイート
describe("cachedGetAuctionListingsAndCount - 効率化版", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // モックの設定
    vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([
      { groupId: "group1" },
      { groupId: "group2" },
      { groupId: "group3" },
    ] as any);

    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
  });

  describe("効率化されたパラメータ組み合わせテスト", () => {
    it("代表的なパラメータ組み合わせで正常に動作する", async () => {
      const combinations = generateEfficientParameterCombinations();

      // バッチサイズを小さくして段階的に処理
      const batchSize = 10;
      for (let i = 0; i < combinations.length; i += batchSize) {
        const batch = combinations.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (params) => {
            const result = await cachedGetAuctionListingsAndCount(params);

            // 結果の基本検証
            expect(result).toBeDefined();
            expect(result).toHaveProperty("listings");
            expect(result).toHaveProperty("count");
            expect(Array.isArray(result.listings)).toBe(true);
            expect(typeof result.count).toBe("number");
            expect(result.count).toBeGreaterThanOrEqual(0);

            // SQL生成の検証
            const calls = vi.mocked(prisma.$queryRaw).mock.calls;
            if (calls.length > 0) {
              calls.forEach((call) => {
                const sql = call[0] as Prisma.Sql;
                validateSQL(sql, params, calls.indexOf(call) % 2 === 0 ? "listing" : "count");
              });
            }
          }),
        );

        // メモリ使用量を制御するため、バッチ間でモックをクリア
        vi.clearAllMocks();
        vi.mocked(prisma.groupMembership.findMany).mockResolvedValue([
          { groupId: "group1" },
          { groupId: "group2" },
          { groupId: "group3" },
        ] as any);
        vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
      }
    });
  });

  describe("エラーハンドリング", () => {
    const errorTestCases = [
      {
        name: "userIdがundefined",
        params: { listingsConditions: AuctionListingsConditionsFactory.build(), userId: undefined as any },
        expected: { listings: [], count: 0 },
      },
      {
        name: "listingsConditionsがnull",
        params: { listingsConditions: null as any, userId: "user1" },
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
          listingsConditions: AuctionListingsConditionsFactory.build({ joinType: "INVALID" as any }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "無効なカテゴリー",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({ categories: ["無効なカテゴリー"] as any }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "無効なソートフィールド",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            sort: [{ field: "invalid" as any, direction: "asc" }],
          }),
          userId: "user1",
        },
        expected: { listings: [], count: 0 },
      },
      {
        name: "無効なソート方向",
        params: {
          listingsConditions: AuctionListingsConditionsFactory.build({
            sort: [{ field: "newest", direction: "invalid" as any }],
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

      // SQLインジェクションが実行されていないことを確認
      calls.forEach((call) => {
        const sql = call[0] as Prisma.Sql;
        expect(sql.sql).not.toContain("DROP TABLE");
        expect(sql.sql).not.toContain("DELETE FROM");
        expect(sql.sql).not.toContain("UPDATE SET");
      });
    });
  });

  // パフォーマンステスト
  describe("パフォーマンステスト", () => {
    it("大量のテストケースを効率的に処理できる", async () => {
      const combinations = generateEfficientParameterCombinations();
      const start = performance.now();

      // 並列処理数を制限してメモリ使用量を抑制
      const concurrencyLimit = 5;
      for (let i = 0; i < combinations.length; i += concurrencyLimit) {
        const batch = combinations.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map((params) => cachedGetAuctionListingsAndCount(params)));
      }

      const executionTime = performance.now() - start;
      console.log(`実行時間: ${executionTime}ms`);
      console.log(`テストケース数: ${combinations.length}`);
      console.log(`平均実行時間: ${executionTime / combinations.length}ms/case`);

      // パフォーマンス要件（適切な範囲内であることを確認）
      expect(executionTime).toBeLessThan(30000); // 30秒以内
    });
  });
});

// ユーティリティ関数のエクスポート
export { generateEfficientParameterCombinations, normalizeSQL, validateSQL };

/**
 * パフォーマンステスト用のヘルパー関数
 */
export function measureExecutionTime(fn: () => Promise<any>): Promise<number> {
  const start = performance.now();
  return fn().then(() => performance.now() - start);
}

/**
 * 効率化された統計情報を出力する関数
 */
export function printEfficientCombinationStatistics(): void {
  const combinations = generateEfficientParameterCombinations();
  console.log(`\n=== 効率化された組み合わせ統計 ===`);
  console.log(`総組み合わせ数: ${combinations.length}`);

  const stats = {
    categories: new Set<string>(),
    status: new Set<string>(),
    joinType: new Set<string>(),
    searchQueryTypes: new Set<string>(),
    sortTypes: new Set<string>(),
  };

  combinations.forEach((combo) => {
    const { listingsConditions } = combo;

    stats.categories.add(JSON.stringify(listingsConditions.categories));
    stats.status.add(JSON.stringify(listingsConditions.status));
    stats.joinType.add(listingsConditions.joinType);
    stats.searchQueryTypes.add(listingsConditions.searchQuery ? "検索あり" : "検索なし");
    stats.sortTypes.add(JSON.stringify(listingsConditions.sort));
  });

  console.log(`カテゴリーパターン数: ${stats.categories.size}`);
  console.log(`ステータスパターン数: ${stats.status.size}`);
  console.log(`JoinTypeパターン数: ${stats.joinType.size}`);
  console.log(`検索タイプ数: ${stats.searchQueryTypes.size}`);
  console.log(`ソートタイプ数: ${stats.sortTypes.size}`);
  console.log(`メモリ効率: 約${((combinations.length / 5000000000) * 100).toFixed(6)}% (元の50億パターンと比較)`);
  console.log(`===========================\n`);
}
