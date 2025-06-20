import type { AuctionListingsConditions } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GetAuctionListingsParams } from "./cache-auction-listing";
import { cachedGetAuctionListingsAndCount } from "./cache-auction-listing";

beforeEach(() => {
  vi.clearAllMocks();
});

const TEST_CONSTANTS = {
  USER_ID: "test-user-id",
  GROUP_ID: "test-group-id",
} as const;

/**
 * テスト用パラメータ作成ヘルパー関数
 */
function createTestParams(conditionsOverrides = {}, userId = TEST_CONSTANTS.USER_ID): GetAuctionListingsParams {
  const defaultConditions: AuctionListingsConditions = {
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
  };

  return {
    listingsConditions: { ...defaultConditions, ...conditionsOverrides },
    userId,
  };
}

/**
 * 成功ケース用のモックセットアップ
 */
function setupSuccessfulMocks() {
  const mockGroupMemberships = [
    groupMembershipFactory.build({
      userId: TEST_CONSTANTS.USER_ID,
      groupId: TEST_CONSTANTS.GROUP_ID,
    }),
  ];

  prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
  prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: BigInt(0) }]);
}

/**
 * 実際のPrisma.sqlテンプレートリテラル形式に正確に合わせたSQL期待値生成関数
 * パラメータ化されたクエリ（?プレースホルダー）に対応
 */
function generateExpectedListingsSQL(params: AuctionListingsConditions): string {
  const { searchQuery, sort } = params;

  // bidsソート用のカラム
  const bidsCountSelect =
    sort && sort.length > 0 && sort[0].field === "bids"
      ? `
            , (SELECT COUNT(*) FROM "BidHistory" bh_sort WHERE bh_sort."auction_id" = a.id) as bids_count_intermediate`
      : "";

  // 全文検索用のカラム
  const ftsSelect =
    searchQuery && searchQuery.trim() !== ""
      ? `
            , pgroonga_score(t.tableoid, t.ctid) as score`
      : "";

  // メインクエリのカラム選択（PaginatedAuctionsCTE用）
  const paginatedBidsCountSelect =
    sort && sort.length > 0 && sort[0].field === "bids"
      ? `
            , bids_count_intermediate`
      : "";

  const paginatedFtsSelect =
    searchQuery && searchQuery.trim() !== ""
      ? `
            , score`
      : "";

  // 最終SELECT文でのスコア用のカラム
  const scoreSelect =
    searchQuery && searchQuery.trim() !== ""
      ? `
            , p.score as score`
      : "";

  // ハイライト用のカラム
  let highlightColumns = "";
  if (searchQuery && searchQuery.trim() !== "") {
    highlightColumns = `
            , pgroonga_highlight_html(t.task, pgroonga_query_extract_keywords(?)) as task_highlighted
            , pgroonga_highlight_html(t.detail, pgroonga_query_extract_keywords(?)) as detail_highlighted`;
  }

  // WHERE句の構築 - パラメータ化
  let whereClause = `a."group_id" = ANY(?::text[])`;

  // 全文検索条件
  if (searchQuery && searchQuery.trim() !== "") {
    whereClause = `public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ? AND ${whereClause}`;
  }

  // カテゴリー条件
  if (params.categories && params.categories.length > 0 && !params.categories.includes("すべて")) {
    const validCategories = params.categories.filter((c) => c !== null && c !== "すべて");
    if (validCategories.length > 0) {
      const catConditions = validCategories.map(() => "t.category ILIKE ?").join(" OR ");
      whereClause += ` AND (${catConditions})`;
    }
  }

  // 入札額条件
  if (params.minBid !== null && params.minBid !== undefined) {
    whereClause += ` AND a."current_highest_bid" >= ?`;
  }
  if (params.maxBid !== null && params.maxBid !== undefined && params.maxBid !== 0) {
    whereClause += ` AND a."current_highest_bid" <= ?`;
  }

  // ORDER BY句の構築
  let orderByClause = 'a."created_at" DESC';
  if (sort && sort.length > 0) {
    const primarySort = sort[0];
    const direction = primarySort.direction === "asc" ? "ASC NULLS LAST" : "DESC NULLS LAST";

    switch (primarySort.field) {
      case "relevance":
        if (searchQuery && searchQuery.trim() !== "") {
          orderByClause = "score DESC";
        }
        break;
      case "newest":
        orderByClause = `"created_at" ${direction}`;
        break;
      case "time_remaining":
        orderByClause = `"end_time" ${direction}`;
        break;
      case "bids":
        orderByClause = `"bids_count_intermediate" ${direction}`;
        break;
      case "price":
        orderByClause = `"current_highest_bid" ${direction}`;
        break;
    }
  } else if (searchQuery && searchQuery.trim() !== "") {
    orderByClause = "score DESC";
  }

  return `
        WITH "FilteredAuctionsCTE" AS (
          SELECT
            a."id",
            a."task_id",
            a."created_at",
            a."end_time",
            a."current_highest_bid"${bidsCountSelect}${ftsSelect}
          FROM "Auction" a
          JOIN "Task" t ON a."task_id" = t.id
          WHERE ${whereClause}
          ORDER BY ${orderByClause}
        ),
        "PaginatedAuctionsCTE" AS (
          SELECT
            "id",
            "task_id",
            "created_at",
            "end_time",
            "current_highest_bid"${paginatedBidsCountSelect}${paginatedFtsSelect}
          FROM "FilteredAuctionsCTE"
          LIMIT ? OFFSET ?
        ),
        "BidsCountCTE" AS (
          SELECT
            bh."auction_id",
            COUNT(bh.id)::bigint as "bids_count"
          FROM "BidHistory" bh
          WHERE bh."auction_id" IN (SELECT id FROM "PaginatedAuctionsCTE")
          GROUP BY bh."auction_id"
        ),
        "WatchlistCTE" AS (
          SELECT
            twl."auction_id",
            TRUE as "is_watched"
          FROM "TaskWatchList" twl
          WHERE twl."auction_id" IN (SELECT id FROM "PaginatedAuctionsCTE")
            AND twl."user_id" = ?
        ),
        "ExecutorsCTE" AS (
          SELECT
            te."task_id",
            json_agg(json_build_object(
              'id', te.id,
              'user_id', u.id,
              'user_image', u.image,
              'username', us.username,
              'rating', COALESCE((SELECT AVG(r.rating) FROM "AuctionReview" r WHERE r."reviewee_id" = u.id), 0)
            ))::text as "executors_json"
          FROM "TaskExecutor" te
          JOIN "User" u ON te."user_id" = u.id
          LEFT JOIN "UserSettings" us ON u.id = us."user_id"
          WHERE te."task_id" IN (SELECT task_id FROM "PaginatedAuctionsCTE")
          GROUP BY te."task_id"
        )
        SELECT
            a."id" as "id",
            a."current_highest_bid" as "current_highest_bid",
            a."end_time" as "end_time",
            a."start_time" as "start_time",
            t."status" as "status",
            a."created_at" as "created_at",
            t."task" as "task",
            t."detail" as "detail",
            t."image_url" as "image_url",
            t."category" as "category",
            g."id" as "group_id",
            g."name" as "group_name",
            COALESCE(bc."bids_count", 0) as "bids_count",
            COALESCE(wc."is_watched", FALSE) as "is_watched",
            ex."executors_json"${scoreSelect}${highlightColumns}
        FROM "PaginatedAuctionsCTE" p
        JOIN "Auction" a ON p.id = a.id
        JOIN "Task" t ON a."task_id" = t.id
        JOIN "Group" g ON a."group_id" = g.id
        LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
        LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
        LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id
        ORDER BY ${orderByClause}
      `;
}

/**
 * カウント用SQLの期待値を生成するヘルパー関数
 * パラメータ化されたクエリ（?プレースホルダー）に対応
 */
function generateExpectedCountSQL(params: AuctionListingsConditions): string {
  const { searchQuery } = params;

  let whereClause = `a."group_id" = ANY(?::text[])`;
  let joinClause = "";

  // 全文検索条件がある場合はTaskテーブルとのJOINが必要
  if (searchQuery && searchQuery.trim() !== "") {
    joinClause = `JOIN "Task" t ON a."task_id" = t.id`;
    whereClause = `public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ? AND ${whereClause}`;
  }

  // カテゴリー条件がある場合
  if (params.categories && params.categories.length > 0 && !params.categories.includes("すべて")) {
    const validCategories = params.categories.filter((c) => c !== null && c !== "すべて");
    if (validCategories.length > 0) {
      if (!joinClause) {
        joinClause = `JOIN "Task" t ON a."task_id" = t.id`;
      }
      const catConditions = validCategories.map(() => "t.category ILIKE ?").join(" OR ");
      whereClause += ` AND (${catConditions})`;
    }
  }

  // 入札額条件
  if (params.minBid !== null && params.minBid !== undefined) {
    whereClause += ` AND a."current_highest_bid" >= ?`;
  }
  if (params.maxBid !== null && params.maxBid !== undefined && params.maxBid !== 0) {
    whereClause += ` AND a."current_highest_bid" <= ?`;
  }

  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        ${joinClause}
        WHERE ${whereClause}
      `;
}

describe("cache-auction-listing SQL生成テスト", () => {
  describe("基本的なSQL生成テスト", () => {
    test("デフォルトパラメータでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams();

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（listings取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      // SQL文字列を正規化して比較（空白文字の違いを吸収）
      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);

      // 2つ目のクエリ（count取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;

      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateExpectedCountSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("全文検索ありでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({ searchQuery: "テスト" });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);

      // カウントクエリも検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;

      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateExpectedCountSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("ソート条件ありでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({
        sort: [{ field: "price" as const, direction: "asc" as const }],
      });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("入札数ソートでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({
        sort: [{ field: "bids" as const, direction: "desc" as const }],
      });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("ページネーションでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({ page: 3 });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });
  });

  describe("異常系・バリデーションテスト", () => {
    test("無効な引数でエラーハンドリングされる", async () => {
      const params = {
        listingsConditions: null as unknown as AuctionListingsConditions,
        userId: TEST_CONSTANTS.USER_ID,
      };

      const result = await cachedGetAuctionListingsAndCount(params as GetAuctionListingsParams);

      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("userIdがnullの場合はエラーハンドリングされる", async () => {
      const params = {
        listingsConditions: createTestParams().listingsConditions,
        userId: null as unknown as string,
      };

      const result = await cachedGetAuctionListingsAndCount(params as GetAuctionListingsParams);

      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("ユーザーがグループに参加していない場合は空の結果を返す", async () => {
      prismaMock.groupMembership.findMany.mockResolvedValue([]);

      const params = createTestParams();

      const result = await cachedGetAuctionListingsAndCount(params);

      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("無効なカテゴリーでバリデーションエラーが発生する", async () => {
      const params = createTestParams({
        categories: ["無効なカテゴリー"],
      });

      const result = await cachedGetAuctionListingsAndCount(params);

      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("無効な入札額でバリデーションエラーが発生する", async () => {
      const params = createTestParams({
        minBid: -100,
      });

      const result = await cachedGetAuctionListingsAndCount(params);

      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    test("無効なページ番号でバリデーションエラーが発生する", async () => {
      const params = createTestParams({
        page: 0,
      });

      const result = await cachedGetAuctionListingsAndCount(params);

      expect(result.listings).toStrictEqual([]);
      expect(result.count).toBe(0);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("境界値テスト", () => {
    test("空文字列の検索クエリでは全文検索が無効になる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({ searchQuery: "" });

      await cachedGetAuctionListingsAndCount(params);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("空配列のソート条件ではデフォルトソートが適用される", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({ sort: [] });

      await cachedGetAuctionListingsAndCount(params);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("空配列のステータス条件では追加のWHERE句が作成されない", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({ status: [] });

      await cachedGetAuctionListingsAndCount(params);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("有効なカテゴリーでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({
        categories: ["デザイン"], // 有効なカテゴリーを使用
      });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("最大値でのページネーションが正しく動作する", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({ page: 999 });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });
  });

  describe("複合条件テスト", () => {
    test("全文検索とソートの組み合わせでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({
        searchQuery: "テスト プロジェクト",
        sort: [{ field: "relevance" as const, direction: "desc" as const }],
      });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);
    });

    test("カテゴリーと入札額の組み合わせでSQL生成が正しく行われる", async () => {
      setupSuccessfulMocks();

      const params = createTestParams({
        categories: ["デザイン", "開発"],
        minBid: 1000,
        maxBid: 5000,
      });

      await cachedGetAuctionListingsAndCount(params);

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;

      const actualSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedSQL = generateExpectedListingsSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualSQL).toStrictEqual(expectedSQL);

      // カウントクエリも検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;

      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateExpectedCountSQL(params.listingsConditions).replace(/\s+/g, " ").trim();

      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });
  });
});
