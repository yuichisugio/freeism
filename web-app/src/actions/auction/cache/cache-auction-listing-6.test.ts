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
 * デフォルト条件を設定
 */
function createDefaultParams(overrides: Partial<AuctionListingsConditions> = {}): GetAuctionListingsParams {
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
    listingsConditions: { ...defaultConditions, ...overrides },
    userId: TEST_CONSTANTS.USER_ID,
    userGroupIds: [TEST_CONSTANTS.GROUP_ID],
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
 * デフォルト条件のオークション一覧取得SQLを生成する関数
 */
function generateDefaultListingsSQL(): string {
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
          ORDER BY a."created_at" DESC NULLS LAST
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
        ORDER BY a."created_at" DESC NULLS LAST
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * デフォルト条件のカウント取得SQLを生成する関数
 */
function generateDefaultCountSQL(): string {
  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        WHERE a."group_id" = ANY(?::text[])
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カテゴリーフィルター適用時のオークション一覧取得SQLを生成する関数
 */
function generateCategoriesListingsSQL(): string {
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
          WHERE a."group_id" = ANY(?::text[]) AND (t.category ILIKE ? OR t.category ILIKE ?)
          ORDER BY a."created_at" DESC NULLS LAST
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
        ORDER BY a."created_at" DESC NULLS LAST
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カテゴリーフィルター適用時のカウント取得SQLを生成する関数
 */
function generateCategoriesCountSQL(): string {
  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        JOIN "Task" t ON a."task_id" = t.id
        WHERE a."group_id" = ANY(?::text[]) AND (t.category ILIKE ? OR t.category ILIKE ?)
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札額フィルター適用時のオークション一覧取得SQLを生成する関数
 */
function generateBidAmountListingsSQL(): string {
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
          WHERE a."group_id" = ANY(?::text[]) AND a."current_highest_bid" >= ? AND a."current_highest_bid" <= ?
          ORDER BY a."created_at" DESC NULLS LAST
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
        ORDER BY a."created_at" DESC NULLS LAST
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札額フィルター適用時のカウント取得SQLを生成する関数
 */
function generateBidAmountCountSQL(): string {
  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        WHERE a."group_id" = ANY(?::text[]) AND a."current_highest_bid" >= ? AND a."current_highest_bid" <= ?
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 価格ソート適用時のオークション一覧取得SQLを生成する関数
 */
function generatePriceSortListingsSQL(): string {
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
          ORDER BY "current_highest_bid" DESC NULLS LAST
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
        ORDER BY "current_highest_bid" DESC NULLS LAST
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索クエリ適用時のオークション一覧取得SQLを生成する関数
 */
function generateSearchQueryListingsSQL(): string {
  return `
        WITH "FilteredAuctionsCTE" AS (
          SELECT
            a."id",
            a."task_id",
            a."created_at",
            a."end_time",
            a."current_highest_bid"
            , pgroonga_score(t.tableoid, t.ctid) as score
          FROM "Auction" a
          JOIN "Task" t ON a."task_id" = t.id
          WHERE public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ? AND a."group_id" = ANY(?::text[])
          ORDER BY score DESC NULLS LAST
        ),
        "PaginatedAuctionsCTE" AS (
          SELECT
            "id",
            "task_id",
            "created_at",
            "end_time",
            "current_highest_bid"
            , score
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
            , p.score as score
            , pgroonga_highlight_html(t.task, pgroonga_query_extract_keywords(?)) as task_highlighted
            , pgroonga_highlight_html(t.detail, pgroonga_query_extract_keywords(?)) as detail_highlighted
        FROM "PaginatedAuctionsCTE" p
        JOIN "Auction" a ON p.id = a.id
        JOIN "Task" t ON a."task_id" = t.id
        JOIN "Group" g ON a."group_id" = g.id
        LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
        LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
        LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id
        ORDER BY score DESC NULLS LAST
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 検索クエリ適用時のカウント取得SQLを生成する関数
 */
function generateSearchQueryCountSQL(): string {
  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        JOIN "Task" t ON a."task_id" = t.id
        WHERE public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ? AND a."group_id" = ANY(?::text[])
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステータスフィルター適用時のオークション一覧取得SQLを生成する関数
 */
function generateStatusFilterListingsSQL(): string {
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
          WHERE a."group_id" = ANY(?::text[]) AND ((NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)) AND (t.status::text = ? OR t.status::text = ?))
          ORDER BY a."created_at" DESC NULLS LAST
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
        ORDER BY a."created_at" DESC NULLS LAST
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステータスフィルター適用時のカウント取得SQLを生成する関数
 */
function generateStatusFilterCountSQL(): string {
  return `
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        JOIN "Task" t ON a."task_id" = t.id
        WHERE a."group_id" = ANY(?::text[]) AND ((NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)) AND (t.status::text = ? OR t.status::text = ?))
      `
    .replace(/\s+/g, " ")
    .trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-auction-listing.ts_cachedGetAuctionListingsAndCount", () => {
  describe("各条件の単体テスト", () => {
    test("デフォルト条件のみの場合のSQL生成テスト", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams();

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateDefaultListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateDefaultCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("カテゴリーフィルター適用時のSQL生成テスト", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams({
        categories: ["デザイン", "開発"],
      });

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateCategoriesListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateCategoriesCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("入札額フィルター適用時のSQL生成テスト", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams({
        minBid: 100,
        maxBid: 1000,
      });

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateBidAmountListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateBidAmountCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("価格ソート適用時のSQL生成テスト", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams({
        sort: [{ field: "price", direction: "desc" }],
      });

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generatePriceSortListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateDefaultCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("検索クエリ適用時のSQL生成テスト", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams({
        searchQuery: "テスト クエリ",
      });

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateSearchQueryListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateSearchQueryCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });

    test("ステータスフィルター適用時のSQL生成テスト", async () => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams({
        status: ["not_bidded", "not_ended"],
      });

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateStatusFilterListingsSQL();
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateStatusFilterCountSQL();
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });
  });
});
