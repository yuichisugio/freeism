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
 * 条件フラグの型定義
 */
type ConditionFlags = {
  hasCategories: boolean;
  hasStatus: boolean;
  hasMinBid: boolean;
  hasMaxBid: boolean;
  hasMinRemainingTime: boolean;
  hasMaxRemainingTime: boolean;
  hasGroupIds: boolean;
  hasSearchQuery: boolean;
  hasSort: boolean;
  sortField?: string;
  sortDirection?: string;
  statusValues?: string[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統一されたオークション一覧取得SQL生成関数
 */
function generateListingsSQL(flags: ConditionFlags): string {
  // 基本のCTEとSELECT部分
  let sql = `
    WITH "FilteredAuctionsCTE" AS (
      SELECT
        a."id",
        a."task_id",
        a."created_at",
        a."end_time",
        a."current_highest_bid"`;

  // 入札数ソート用の追加カラム
  if (flags.hasSort && flags.sortField === "bids") {
    sql += `
            , (SELECT COUNT(*) FROM "BidHistory" bh_sort WHERE bh_sort."auction_id" = a.id) as bids_count_intermediate`;
  }

  // 全文検索用のスコア
  if (flags.hasSearchQuery) {
    sql += `
            , pgroonga_score(t.tableoid, t.ctid) as score`;
  }

  sql += `
      FROM "Auction" a
      JOIN "Task" t ON a."task_id" = t.id
      WHERE a."group_id" = ANY(?::text[])`;

  // 全文検索条件
  if (flags.hasSearchQuery) {
    sql = sql.replace(
      'WHERE a."group_id" = ANY(?::text[])',
      "WHERE public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ? AND a.\"group_id\" = ANY(?::text[])",
    );
  }

  // カテゴリー条件
  if (flags.hasCategories) {
    sql += ` AND (t.category ILIKE ? OR t.category ILIKE ?)`;
  }

  // ステータス条件（複雑な処理）
  if (flags.hasStatus && flags.statusValues) {
    if (flags.statusValues.includes("watchlist")) {
      sql += ` AND ((EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = ?)))`;
    } else if (flags.statusValues.includes("not_bidded")) {
      // not_biddedは単独で処理され、not_ended条件は自動で追加されない
      sql += ` AND ((NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)))`;
    } else if (flags.statusValues.includes("bidded")) {
      sql += ` AND ((EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)))`;
    } else if (flags.statusValues.includes("ended")) {
      sql += ` AND ((t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ?))`;
    } else if (flags.statusValues.includes("not_ended")) {
      sql += ` AND ((t.status::text = ? OR t.status::text = ?))`;
    } else if (flags.statusValues.includes("not_started")) {
      sql += ` AND (((t.status::text = ? AND a."start_time" >= ?)))`;
    } else if (flags.statusValues.includes("started")) {
      sql += ` AND (((t.status::text = ? AND a."start_time" <= ?)))`;
    }
  }

  // 入札額条件
  if (flags.hasMinBid) {
    sql += ` AND a."current_highest_bid" >= ?`;
  }
  if (flags.hasMaxBid) {
    sql += ` AND a."current_highest_bid" <= ?`;
  }

  // 残り時間条件
  if (flags.hasMinRemainingTime) {
    sql += ` AND a."end_time" >= ?`;
  }
  if (flags.hasMaxRemainingTime) {
    sql += ` AND a."end_time" <= ?`;
  }

  // グループID条件（追加のフィルター）
  if (flags.hasGroupIds) {
    sql += ` AND a."group_id" = ANY(?::text[])`;
  }

  // ORDER BY句
  if (flags.hasSort) {
    if (flags.sortField === "price") {
      sql += `
      ORDER BY "current_highest_bid" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "bids") {
      sql += `
      ORDER BY "bids_count_intermediate" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "time_remaining") {
      sql += `
      ORDER BY "end_time" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "newest") {
      sql += `
      ORDER BY "created_at" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "relevance") {
      if (flags.hasSearchQuery) {
        sql += `
      ORDER BY score DESC`;
      } else {
        sql += `
      ORDER BY a."created_at" DESC`;
      }
    } else if (flags.sortField === "score") {
      // スコアソートの場合は全文検索の条件を追加する必要がある
      if (!flags.hasSearchQuery) {
        // スコアソートが指定されているが検索クエリがない場合は、デフォルトソートにする
        sql += `
      ORDER BY a."created_at" DESC`;
      } else {
        sql += `
      ORDER BY score ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
      }
    }
  } else if (flags.hasSearchQuery) {
    sql += `
      ORDER BY score DESC`;
  } else {
    sql += `
      ORDER BY a."created_at" DESC`;
  }

  // 残りのCTE部分
  sql += `
    ),
    "PaginatedAuctionsCTE" AS (
      SELECT
        "id",
        "task_id",
        "created_at",
        "end_time",
        "current_highest_bid"`;

  if (flags.hasSort && flags.sortField === "bids") {
    sql += `
        , bids_count_intermediate`;
  }
  if (flags.hasSearchQuery) {
    sql += `
        , score`;
  }

  sql += `
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
        ex."executors_json"`;

  if (flags.hasSearchQuery) {
    sql += `
        , p.score as score
        , pgroonga_highlight_html(t.task, pgroonga_query_extract_keywords(?)) as task_highlighted
        , pgroonga_highlight_html(t.detail, pgroonga_query_extract_keywords(?)) as detail_highlighted`;
  }

  sql += `
    FROM "PaginatedAuctionsCTE" p
    JOIN "Auction" a ON p.id = a.id
    JOIN "Task" t ON a."task_id" = t.id
    JOIN "Group" g ON a."group_id" = g.id
    LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
    LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
    LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id`;

  // 最終的なORDER BY句
  if (flags.hasSort) {
    if (flags.sortField === "price") {
      sql += `
    ORDER BY "current_highest_bid" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "bids") {
      sql += `
    ORDER BY "bids_count_intermediate" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "time_remaining") {
      sql += `
    ORDER BY "end_time" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "newest") {
      sql += `
    ORDER BY "created_at" ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (flags.sortField === "relevance") {
      if (flags.hasSearchQuery) {
        sql += `
    ORDER BY score DESC`;
      } else {
        sql += `
    ORDER BY a."created_at" DESC`;
      }
    } else if (flags.sortField === "score") {
      // スコアソートの場合は全文検索の条件を追加する必要がある
      if (!flags.hasSearchQuery) {
        // スコアソートが指定されているが検索クエリがない場合は、デフォルトソートにする
        sql += `
    ORDER BY a."created_at" DESC`;
      } else {
        sql += `
    ORDER BY score ${flags.sortDirection?.toUpperCase()} NULLS LAST`;
      }
    }
  } else if (flags.hasSearchQuery) {
    sql += `
    ORDER BY score DESC`;
  } else {
    sql += `
    ORDER BY a."created_at" DESC`;
  }

  return sql.replace(/\s+/g, " ").trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統一されたカウント取得SQL生成関数
 */
function generateCountSQL(flags: ConditionFlags): string {
  let sql = `
    SELECT COUNT(*)::bigint as count
    FROM "Auction" a`;

  // JOIN条件の判定 - 実際のコードに合わせて修正
  // watchlist, bidded, not_bidded ステータスはt.を含まないため、JOINは不要
  // ended, not_ended, not_started, started ステータスはt.を含むため、JOINが必要
  const needsTaskJoin =
    flags.hasCategories ||
    flags.hasSearchQuery ||
    (flags.hasStatus &&
      flags.statusValues &&
      (flags.statusValues.includes("ended") ||
        flags.statusValues.includes("not_ended") ||
        flags.statusValues.includes("not_started") ||
        flags.statusValues.includes("started")));

  if (needsTaskJoin) {
    sql += `
    JOIN "Task" t ON a."task_id" = t.id`;
  }

  sql += `
    WHERE a."group_id" = ANY(?::text[])`;

  // 全文検索条件
  if (flags.hasSearchQuery) {
    sql = sql.replace(
      'WHERE a."group_id" = ANY(?::text[])',
      "WHERE public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ? AND a.\"group_id\" = ANY(?::text[])",
    );
  }

  // カテゴリー条件
  if (flags.hasCategories) {
    sql += ` AND (t.category ILIKE ? OR t.category ILIKE ?)`;
  }

  // ステータス条件（実際のコードに合わせて修正）
  if (flags.hasStatus && flags.statusValues) {
    if (flags.statusValues.includes("watchlist")) {
      sql += ` AND ((EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = ?)))`;
    } else if (flags.statusValues.includes("not_bidded")) {
      // not_biddedは単独で処理され、not_ended条件は自動で追加されない
      sql += ` AND ((NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)))`;
    } else if (flags.statusValues.includes("bidded")) {
      sql += ` AND ((EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)))`;
    } else if (flags.statusValues.includes("ended")) {
      sql += ` AND ((t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ? OR t.status::text = ?))`;
    } else if (flags.statusValues.includes("not_ended")) {
      sql += ` AND ((t.status::text = ? OR t.status::text = ?))`;
    } else if (flags.statusValues.includes("not_started")) {
      sql += ` AND (((t.status::text = ? AND a."start_time" >= ?)))`;
    } else if (flags.statusValues.includes("started")) {
      sql += ` AND (((t.status::text = ? AND a."start_time" <= ?)))`;
    }
  }

  // 入札額条件
  if (flags.hasMinBid) {
    sql += ` AND a."current_highest_bid" >= ?`;
  }
  if (flags.hasMaxBid) {
    sql += ` AND a."current_highest_bid" <= ?`;
  }

  // 残り時間条件
  if (flags.hasMinRemainingTime) {
    sql += ` AND a."end_time" >= ?`;
  }
  if (flags.hasMaxRemainingTime) {
    sql += ` AND a."end_time" <= ?`;
  }

  // グループID条件（追加のフィルター）
  if (flags.hasGroupIds) {
    sql += ` AND a."group_id" = ANY(?::text[])`;
  }

  return sql.replace(/\s+/g, " ").trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-auction-listing.ts_cachedGetAuctionListingsAndCount", () => {
  describe("test.each()を使用した条件別SQLテスト", () => {
    // テストケースの定義
    const testCases = [
      {
        name: "デフォルト条件のみ",
        conditions: {},
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "カテゴリーフィルター適用",
        conditions: { categories: ["デザイン", "開発"] },
        flags: {
          hasCategories: true,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "ウォッチリストステータスフィルター適用",
        conditions: { status: ["watchlist"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["watchlist"],
        },
      },
      {
        name: "未入札ステータスフィルター適用",
        conditions: { status: ["not_bidded"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["not_bidded"],
        },
      },
      {
        name: "入札済みステータスフィルター適用",
        conditions: { status: ["bidded"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["bidded"],
        },
      },
      {
        name: "終了済みステータスフィルター適用",
        conditions: { status: ["ended"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["ended"],
        },
      },
      {
        name: "未終了ステータスフィルター適用",
        conditions: { status: ["not_ended"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["not_ended"],
        },
      },
      {
        name: "未開始ステータスフィルター適用",
        conditions: { status: ["not_started"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["not_started"],
        },
      },
      {
        name: "開始済みステータスフィルター適用",
        conditions: { status: ["started"] },
        flags: {
          hasCategories: false,
          hasStatus: true,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
          statusValues: ["started"],
        },
      },
      {
        name: "最小入札額フィルター適用",
        conditions: { minBid: 100 },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: true,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "最大入札額フィルター適用",
        conditions: { maxBid: 1000 },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: true,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "入札額範囲フィルター適用",
        conditions: { minBid: 100, maxBid: 1000 },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: true,
          hasMaxBid: true,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "検索クエリ適用",
        conditions: { searchQuery: "テスト クエリ" },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: true,
          hasSort: false,
        },
      },
      {
        name: "価格ソート（降順）適用",
        conditions: { sort: [{ field: "price", direction: "desc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "price",
          sortDirection: "desc",
        },
      },
      {
        name: "価格ソート（昇順）適用",
        conditions: { sort: [{ field: "price", direction: "asc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "price",
          sortDirection: "asc",
        },
      },
      {
        name: "入札数ソート適用",
        conditions: { sort: [{ field: "bids", direction: "desc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "bids",
          sortDirection: "desc",
        },
      },
      {
        name: "残り時間ソート適用",
        conditions: { sort: [{ field: "time_remaining", direction: "asc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "time_remaining",
          sortDirection: "asc",
        },
      },
      {
        name: "新着順ソート適用",
        conditions: { sort: [{ field: "newest", direction: "desc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "newest",
          sortDirection: "desc",
        },
      },
      {
        name: "関連度ソート適用",
        conditions: { sort: [{ field: "relevance", direction: "desc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "relevance",
          sortDirection: "desc",
        },
      },
      {
        name: "スコアソート適用",
        conditions: { sort: [{ field: "score", direction: "desc" }] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: true,
          sortField: "score",
          sortDirection: "desc",
        },
      },
      {
        name: "最小残り時間フィルター適用",
        conditions: { minRemainingTime: 24 },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: true,
          hasMaxRemainingTime: false,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "最大残り時間フィルター適用",
        conditions: { maxRemainingTime: 168 },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: true,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "残り時間範囲フィルター適用",
        conditions: { minRemainingTime: 24, maxRemainingTime: 168 },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: true,
          hasMaxRemainingTime: true,
          hasGroupIds: false,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
      {
        name: "グループIDフィルター適用",
        conditions: { groupIds: ["test-group-id"] },
        flags: {
          hasCategories: false,
          hasStatus: false,
          hasMinBid: false,
          hasMaxBid: false,
          hasMinRemainingTime: false,
          hasMaxRemainingTime: false,
          hasGroupIds: true,
          hasSearchQuery: false,
          hasSort: false,
        },
      },
    ];

    test.each(testCases)("$name の場合のSQL生成テスト", async ({ conditions, flags }) => {
      // Arrange
      setupSuccessfulMocks();
      const params = createDefaultParams(conditions);

      // Act
      await cachedGetAuctionListingsAndCount(params);

      // Assert
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);

      // 1つ目のクエリ（オークション一覧取得用）のSQL検証
      const firstCall = prismaMock.$queryRaw.mock.calls[0];
      const listingsSql = firstCall[0] as Prisma.Sql;
      const actualListingsSQL = listingsSql.sql.replace(/\s+/g, " ").trim();
      const expectedListingsSQL = generateListingsSQL(flags);
      expect(actualListingsSQL).toStrictEqual(expectedListingsSQL);

      // 2つ目のクエリ（件数取得用）のSQL検証
      const secondCall = prismaMock.$queryRaw.mock.calls[1];
      const countSql = secondCall[0] as Prisma.Sql;
      const actualCountSQL = countSql.sql.replace(/\s+/g, " ").trim();
      const expectedCountSQL = generateCountSQL(flags);
      expect(actualCountSQL).toStrictEqual(expectedCountSQL);
    });
  });
});
