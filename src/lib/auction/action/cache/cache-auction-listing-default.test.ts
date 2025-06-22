import type { AuctionListingsConditions } from "@/types/auction-types";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { type Prisma } from "@prisma/client";
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
} as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テストパラメータ作成ヘルパー
 * use-auction-listings.tsの内容を参考に、必須項目以外の指定がない場合のデフォルト値を使用
 */
function createDefaultParams(): GetAuctionListingsParams {
  const listingsConditions: AuctionListingsConditions = {
    categories: ["すべて"], // 必須項目以外の指定がない場合のデフォルト値
    status: ["all"], // 必須項目以外の指定がない場合のデフォルト値
    joinType: "AND", // 必須項目以外の指定がない場合のデフォルト値
    minBid: null,
    maxBid: null,
    minRemainingTime: null,
    maxRemainingTime: null,
    groupIds: null,
    searchQuery: null,
    sort: null,
    page: 1, // 必須項目以外の指定がない場合のデフォルト値
  };

  return {
    listingsConditions,
    userId: TEST_CONSTANTS.USER_ID,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックの成功レスポンスを設定するヘルパー
 */
function setupSuccessfulMocks() {
  // ユーザーがテストグループに参加しているモック
  const mockGroupMemberships = [
    groupMembershipFactory.build({
      userId: TEST_CONSTANTS.USER_ID,
      groupId: TEST_CONSTANTS.GROUP_ID,
    }),
  ];

  // 空のオークションデータとカウントを返すモック
  prismaMock.groupMembership.findMany.mockResolvedValue(mockGroupMemberships);
  prismaMock.$queryRaw
    .mockResolvedValueOnce([]) // オークションデータのモック（空配列）
    .mockResolvedValueOnce([{ count: BigInt(0) }]); // 件数のモック
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待されるオークション一覧取得SQLを生成する関数
 * @returns 期待されるオークション一覧取得SQL
 */
function generateExpectedListingsSQL(): string {
  return `
        WITH "FilteredAuctionsCTE" AS (
          SELECT
            a."id",
            a."task_id",
            a."created_at",
            a."end_time",
            a."current_highest_bid"
          FROM "Auction" a
          JOIN "Task" t ON a."task_id" = t.id
          WHERE a."group_id" = ANY(?::text[])
          ORDER BY a."created_at" DESC
        ),
        "PaginatedAuctionsCTE" AS (
          SELECT
            "id",
            "task_id",
            "created_at",
            "end_time",
            "current_highest_bid"
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
            ex."executors_json"
        FROM "PaginatedAuctionsCTE" p
        JOIN "Auction" a ON p.id = a.id
        JOIN "Task" t ON a."task_id" = t.id
        JOIN "Group" g ON a."group_id" = g.id
        LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
        LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
        LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id
        ORDER BY a."created_at" DESC
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 期待されるカウント取得SQLを生成する関数
 * @returns 期待されるカウント取得SQL
 */
function generateExpectedCountSQL(): string {
  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        WHERE a."group_id" = ANY(?::text[])
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-auction-listing.ts_cachedGetAuctionListingsAndCount", () => {
  describe("必須項目以外の指定がない場合のSQL生成テスト", () => {
    test("引数で必須項目以外の指定がない場合の関数呼び出し時のprisma.$queryRaw()に渡されるSQLを検証", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams();

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      // prismaの$queryRawが2回呼び出されることを確認（オークション一覧取得と件数取得）
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateExpectedListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateExpectedCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });
  });
});
