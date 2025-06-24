/**
 * カテゴリーのテスト
 * ステータスのテスト
 * ページネーションのテスト
 */
import type { AuctionListingsConditions, JoinType } from "@/types/auction-types";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { prismaMock } from "@/test/setup/prisma-orm-setup";
import { groupMembershipFactory } from "@/test/test-utils/test-utils-prisma-orm";
import { auctionFilterArray, auctionSortFieldArray, joinTypeArray, sortDirectionArray } from "@/types/auction-types";
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
    userGroupIds: [],
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
  hasCategories?: boolean;
  hasStatus?: boolean;
  hasMinBid?: boolean;
  hasMaxBid?: boolean;
  hasMinRemainingTime?: boolean;
  hasMaxRemainingTime?: boolean;
  hasGroupIds?: boolean;
  hasSearchQuery?: boolean;
  hasSort?: boolean;
  sortField?: string;
  sortDirection?: string;
  statusValues?: string[];
  joinType?: JoinType;
  categoryCount?: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統一されたオークション一覧取得SQL生成関数
 */
function generateListingsSQL(flags: ConditionFlags): string {
  const {
    hasCategories = false,
    hasStatus = false,
    hasMinBid = false,
    hasMaxBid = false,
    hasMinRemainingTime = false,
    hasMaxRemainingTime = false,
    hasGroupIds = false,
    hasSearchQuery = false,
    hasSort = false,
    sortField = "",
    sortDirection = "",
    statusValues = [],
    joinType = "OR",
    categoryCount = 0,
  } = flags;

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
  if (hasSort && sortField === "bids") {
    sql += `
            , (SELECT COUNT(*) FROM "BidHistory" bh_sort WHERE bh_sort."auction_id" = a.id) as bids_count_intermediate`;
  }

  // 全文検索用のスコア
  if (hasSearchQuery) {
    sql += `
            , pgroonga_score(t.tableoid, t.ctid) as score`;
  }

  // 実装では常にJOIN "Task" tが含まれている
  sql += `
      FROM "Auction" a
      JOIN "Task" t ON a."task_id" = t.id`;

  // WHERE句の開始
  const whereConditions: string[] = [];

  // 基本的なグループ条件
  whereConditions.push('a."group_id" = ANY(?::text[])');

  // 全文検索条件
  if (hasSearchQuery) {
    whereConditions.unshift("public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ?");
  }

  // カテゴリー条件
  if (hasCategories) {
    if ((categoryCount ?? 0) > 1) {
      const categoryConditions = Array.from({ length: categoryCount ?? 0 }, () => "t.category ILIKE ?");
      whereConditions.push(`(${categoryConditions.join(" OR ")})`);
    } else {
      whereConditions.push("(t.category ILIKE ?)");
    }
  }

  // ステータス条件
  if (hasStatus && statusValues) {
    const joinOperator = joinType === "AND" ? " AND " : " OR ";
    const watchlistConditions: string[] = [];
    const bidConditions: string[] = [];
    const statusConditions: string[] = [];

    // 実装では'all'ステータスは単に無視される（何も条件を追加しない）
    statusValues.forEach((statusItem) => {
      // 'all'ステータスは何も処理しない（実装に合わせる）
      if (statusItem === "all") {
        return;
      }
      switch (statusItem) {
        case "watchlist":
          watchlistConditions.push(
            'EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = ?)',
          );
          break;
        case "not_bidded":
          bidConditions.push(
            'NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)',
          );
          break;
        case "bidded":
          bidConditions.push(
            'EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)',
          );
          break;
        case "ended":
          statusConditions.push(
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
          );
          break;
        case "not_ended":
          statusConditions.push("t.status::text = ?", "t.status::text = ?");
          break;
        case "not_started":
          statusConditions.push('(t.status::text = ? AND a."start_time" >= ?)');
          break;
        case "started":
          statusConditions.push('(t.status::text = ? AND a."start_time" <= ?)');
          break;
      }
    });

    const combinedConditions: string[] = [];
    if (watchlistConditions.length > 0) {
      combinedConditions.push(`(${watchlistConditions.join(joinOperator)})`);
    }
    if (bidConditions.length > 0) {
      combinedConditions.push(`(${bidConditions.join(joinOperator)})`);
    }
    if (statusConditions.length > 0) {
      combinedConditions.push(`(${statusConditions.join(" OR ")})`);
    }
    if (combinedConditions.length > 0) {
      whereConditions.push(`(${combinedConditions.join(" AND ")})`);
    }
  }

  // 入札額条件
  if (hasMinBid) {
    whereConditions.push('a."current_highest_bid" >= ?');
  }
  if (hasMaxBid) {
    whereConditions.push('a."current_highest_bid" <= ?');
  }

  // 残り時間条件
  if (hasMinRemainingTime) {
    whereConditions.push('a."end_time" >= ?');
  }
  if (hasMaxRemainingTime) {
    whereConditions.push('a."end_time" <= ?');
  }

  // グループID条件（追加のフィルター）
  if (hasGroupIds) {
    whereConditions.push('a."group_id" = ANY(?::text[])');
  }

  // WHERE句を追加
  if (whereConditions.length > 0) {
    sql += `
      WHERE ${whereConditions.join(" AND ")}`;
  }

  // ORDER BY句 - 実装のdirectionSqlに既にNULLS LASTが含まれているため重複を避ける
  if (hasSort) {
    if (sortField === "price") {
      sql += `
      ORDER BY "current_highest_bid" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "bids") {
      sql += `
      ORDER BY "bids_count_intermediate" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "time_remaining") {
      sql += `
      ORDER BY "end_time" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "newest") {
      sql += `
      ORDER BY "created_at" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "relevance") {
      if (hasSearchQuery) {
        sql += `
      ORDER BY score DESC NULLS LAST`;
      } else {
        sql += `
      ORDER BY a."created_at" DESC NULLS LAST`;
      }
    } else if (sortField === "score") {
      if (!hasSearchQuery) {
        sql += `
      ORDER BY a."created_at" DESC NULLS LAST`;
      } else {
        sql += `
      ORDER BY score ${sortDirection?.toUpperCase()} NULLS LAST`;
      }
    }
  } else {
    if (hasSearchQuery) {
      sql += `
      ORDER BY score DESC NULLS LAST`;
    } else {
      sql += `
      ORDER BY a."created_at" DESC NULLS LAST`;
    }
  }

  sql += `
    ),
    "PaginatedAuctionsCTE" AS (
      SELECT
        "id",
        "task_id",
        "created_at",
        "end_time",
        "current_highest_bid"`;

  // 入札数ソート用のカラム
  if (hasSort && sortField === "bids") {
    sql += `
        , bids_count_intermediate`;
  }

  // 全文検索用のスコア
  if (hasSearchQuery) {
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

  if (hasSearchQuery) {
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
  if (hasSort) {
    if (sortField === "price") {
      sql += `
    ORDER BY "current_highest_bid" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "bids") {
      sql += `
    ORDER BY "bids_count_intermediate" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "time_remaining") {
      sql += `
    ORDER BY "end_time" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "newest") {
      sql += `
    ORDER BY "created_at" ${sortDirection?.toUpperCase()} NULLS LAST`;
    } else if (sortField === "relevance") {
      if (hasSearchQuery) {
        sql += `
    ORDER BY score DESC NULLS LAST`;
      } else {
        sql += `
    ORDER BY a."created_at" DESC NULLS LAST`;
      }
    } else if (sortField === "score") {
      if (!hasSearchQuery) {
        sql += `
    ORDER BY a."created_at" DESC NULLS LAST`;
      } else {
        sql += `
    ORDER BY score ${sortDirection?.toUpperCase()} NULLS LAST`;
      }
    }
  } else {
    if (hasSearchQuery) {
      sql += `
    ORDER BY score DESC NULLS LAST`;
    } else {
      sql += `
    ORDER BY a."created_at" DESC NULLS LAST`;
    }
  }

  return sql.replace(/\s+/g, " ").trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 統一されたカウント取得SQL生成関数
 */
function generateCountSQL(flags: ConditionFlags): string {
  const {
    hasCategories = false,
    hasStatus = false,
    hasMinBid = false,
    hasMaxBid = false,
    hasMinRemainingTime = false,
    hasMaxRemainingTime = false,
    hasGroupIds = false,
    hasSearchQuery = false,
    statusValues = [],
    joinType = "OR",
    categoryCount = 0,
  } = flags;

  let sql = `
    SELECT COUNT(*)::bigint as count
    FROM "Auction" a`;

  const whereConditions: string[] = [];

  // 基本的なグループ条件
  whereConditions.push('a."group_id" = ANY(?::text[])');

  // 全文検索条件
  if (hasSearchQuery) {
    whereConditions.unshift("public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ?");
  }

  // カテゴリー条件
  if (hasCategories) {
    if ((categoryCount ?? 0) > 1) {
      const categoryConditions = Array.from({ length: categoryCount ?? 0 }, () => "t.category ILIKE ?");
      whereConditions.push(`(${categoryConditions.join(" OR ")})`);
    } else {
      whereConditions.push("(t.category ILIKE ?)");
    }
  }

  // ステータス条件
  if (hasStatus && statusValues) {
    const joinOperator = joinType === "AND" ? " AND " : " OR ";
    const watchlistConditions: string[] = [];
    const bidConditions: string[] = [];
    const statusConditions: string[] = [];

    // 実装では'all'ステータスは単に無視される（何も条件を追加しない）
    statusValues.forEach((statusItem) => {
      // 'all'ステータスは何も処理しない（実装に合わせる）
      if (statusItem === "all") {
        return;
      }
      switch (statusItem) {
        case "watchlist":
          watchlistConditions.push(
            'EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = ?)',
          );
          break;
        case "not_bidded":
          bidConditions.push(
            'NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)',
          );
          break;
        case "bidded":
          bidConditions.push(
            'EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ?)',
          );
          break;
        case "ended":
          statusConditions.push(
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
            "t.status::text = ?",
          );
          break;
        case "not_ended":
          statusConditions.push("t.status::text = ?", "t.status::text = ?");
          break;
        case "not_started":
          statusConditions.push('(t.status::text = ? AND a."start_time" >= ?)');
          break;
        case "started":
          statusConditions.push('(t.status::text = ? AND a."start_time" <= ?)');
          break;
      }
    });

    const combinedConditions: string[] = [];
    if (watchlistConditions.length > 0) {
      combinedConditions.push(`(${watchlistConditions.join(joinOperator)})`);
    }
    if (bidConditions.length > 0) {
      combinedConditions.push(`(${bidConditions.join(joinOperator)})`);
    }
    if (statusConditions.length > 0) {
      combinedConditions.push(`(${statusConditions.join(" OR ")})`);
    }
    if (combinedConditions.length > 0) {
      whereConditions.push(`(${combinedConditions.join(" AND ")})`);
    }
  }

  // 入札額条件
  if (hasMinBid) {
    whereConditions.push('a."current_highest_bid" >= ?');
  }
  if (hasMaxBid) {
    whereConditions.push('a."current_highest_bid" <= ?');
  }

  // 残り時間条件
  if (hasMinRemainingTime) {
    whereConditions.push('a."end_time" >= ?');
  }
  if (hasMaxRemainingTime) {
    whereConditions.push('a."end_time" <= ?');
  }

  // グループID条件（追加のフィルター）
  if (hasGroupIds) {
    whereConditions.push('a."group_id" = ANY(?::text[])');
  }

  // needsTaskJoinForCountのロジック - t.を含む条件がある場合はJOINが必要
  const needsTaskJoin = whereConditions.some((condition) => condition.includes("t."));

  if (needsTaskJoin) {
    sql += `
    JOIN "Task" t ON a."task_id" = t.id`;
  }

  // WHERE句を追加
  if (whereConditions.length > 0) {
    sql += `
      WHERE ${whereConditions.join(" AND ")}`;
  }

  return sql.replace(/\s+/g, " ").trim();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステータスの2つの組み合わせを生成する関数
 */
function generateStatusCombinations(): Array<[string, string]> {
  const statuses = auctionFilterArray;
  const combinations: Array<[string, string]> = [];

  for (let i = 0; i < statuses.length; i++) {
    for (let j = i + 1; j < statuses.length; j++) {
      combinations.push([statuses[i], statuses[j]]);
    }
  }

  return combinations;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ステータス2つの組み合わせとjoinTypeの全組み合わせテストケースを生成
 */
function generateStatusJoinTypeCombinations() {
  const statusCombinations = generateStatusCombinations();
  const joinTypes: Array<JoinType> = joinTypeArray;
  const testCases = [];

  for (const [status1, status2] of statusCombinations) {
    for (const joinType of joinTypes) {
      // 実装では'all'ステータスは無視されるため、'all'以外のステータスがある場合のみhasStatus: trueを設定
      const nonAllStatuses = [status1, status2].filter((s) => s !== "all");
      const hasStatus = nonAllStatuses.length > 0;

      testCases.push({
        name: `ステータスフィルター適用(${status1} + ${status2}, ${joinType}結合)`,
        conditions: { status: [status1, status2], joinType },
        flags: {
          hasStatus,
          statusValues: [status1, status2],
          joinType,
        },
      });
    }
  }

  return testCases;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ソート条件の全組み合わせを生成する関数
 */
function generateSortCombinations() {
  const sortFields = auctionSortFieldArray;
  const directions = sortDirectionArray;
  const testCases = [];

  for (const field of sortFields) {
    for (const direction of directions) {
      testCases.push({
        name: `${field}ソート（${direction === "asc" ? "昇順" : "降順"}）適用`,
        conditions: { sort: [{ field, direction }] },
        flags: {
          hasSort: true,
          sortField: field,
          sortDirection: direction,
        },
      });
    }
  }

  return testCases;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 単一ステータスとjoinTypeの組み合わせを生成する関数
 */
function generateSingleStatusJoinTypeCombinations() {
  const statuses = auctionFilterArray;
  const joinTypes: Array<JoinType> = joinTypeArray;
  const testCases = [];

  for (const status of statuses) {
    for (const joinType of joinTypes) {
      // 実装では'all'ステータスは無視されるため、'all'以外の場合のみhasStatus: trueを設定
      const hasStatus = status !== "all";

      testCases.push({
        name: `単一ステータスフィルター適用(${status}, ${joinType}結合)`,
        conditions: { status: [status], joinType },
        flags: {
          hasStatus,
          statusValues: [status],
          joinType,
        },
      });
    }
  }

  return testCases;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 単一ステータスとjoinTypeの組み合わせを生成する関数
 */
function generateSingleCategoryCombinations() {
  const categories = AUCTION_CONSTANTS.AUCTION_CATEGORIES;
  const testCases = [];

  for (const category of categories) {
    testCases.push({
      name: `カテゴリー適用(${category})`,
      conditions: { categories: [category] },
      flags: {
        hasCategories: true,
        categoryCount: 1,
      },
    });
  }
  return testCases;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 複数カテゴリーの組み合わせを生成する関数
 */
function generateMultipleCategoriesCombinations() {
  const categories = AUCTION_CONSTANTS.AUCTION_CATEGORIES;
  const testCases = [];

  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      testCases.push({
        name: `カテゴリー適用(${categories[i]} + ${categories[j]})`,
        conditions: { categories: [categories[i], categories[j]] },
        flags: {
          hasCategories: true,
          categoryCount: 2,
        },
      });
    }
  }
  return testCases;
}
// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 複合条件のテストケースを生成する関数
 */
function generateComplexConditionsCombinations() {
  return [
    {
      name: "複合条件(カテゴリー + ステータス + ページネーション)",
      conditions: { categories: ["コード"], status: ["watchlist"], page: 2, joinType: "OR" },
      flags: {
        hasCategories: true,
        hasStatus: true,
        statusValues: ["watchlist"],
        categoryCount: 1,
        page: 2,
      },
    },
    {
      name: "複合条件(検索クエリ + ステータス + ソート + ページネーション)",
      conditions: {
        searchQuery: "テスト検索",
        status: ["bidded"],
        sort: [{ field: "price", direction: "desc" }],
        page: 3,
        joinType: "AND",
      },
      flags: {
        hasSearchQuery: true,
        hasStatus: true,
        hasSort: true,
        statusValues: ["bidded"],
        sortField: "price",
        sortDirection: "desc",
        joinType: "AND" as const,
        page: 3,
      },
    },
    {
      name: "複合条件(複数カテゴリー + 複数ステータス + 入札額範囲 + ソート)",
      conditions: {
        categories: ["デザイン", "開発"],
        status: ["watchlist", "bidded"],
        minBid: 500,
        maxBid: 2000,
        sort: [{ field: "time_remaining", direction: "asc" }],
        joinType: "OR",
      },
      flags: {
        hasCategories: true,
        hasStatus: true,
        hasMinBid: true,
        hasMaxBid: true,
        hasSort: true,
        categoryCount: 2,
        statusValues: ["watchlist", "bidded"],
        sortField: "time_remaining",
        sortDirection: "asc",
        joinType: "OR" as const,
      },
    },
    {
      name: "複合条件(検索クエリ + カテゴリー + 残り時間範囲 + グループID + ページネーション)",
      conditions: {
        searchQuery: "プログラミング タスク",
        categories: ["コード", "開発"],
        minRemainingTime: 12,
        maxRemainingTime: 72,
        groupIds: ["test-group-id"],
        page: 5,
        joinType: "AND",
      },
      flags: {
        hasSearchQuery: true,
        hasCategories: true,
        hasMinRemainingTime: true,
        hasMaxRemainingTime: true,
        hasGroupIds: true,
        categoryCount: 2,
        joinType: "AND" as const,
        page: 5,
      },
    },
    {
      name: "複合条件(全ステータス + 全入札額条件 + 全残り時間条件 + 検索クエリ + ソート)",
      conditions: {
        status: ["ended", "not_ended", "started"],
        minBid: 100,
        maxBid: 5000,
        minRemainingTime: 6,
        maxRemainingTime: 168,
        searchQuery: "緊急 依頼",
        sort: [{ field: "relevance", direction: "desc" }],
        joinType: "OR",
      },
      flags: {
        hasStatus: true,
        hasMinBid: true,
        hasMaxBid: true,
        hasMinRemainingTime: true,
        hasMaxRemainingTime: true,
        hasSearchQuery: true,
        hasSort: true,
        statusValues: ["ended", "not_ended", "started"],
        sortField: "relevance",
        sortDirection: "desc",
        joinType: "OR" as const,
      },
    },
    {
      name: "複合条件(3つのカテゴリー + 2つのステータス + 入札数ソート + 高ページ数)",
      conditions: {
        categories: ["マーケティング", "ライティング", "事務作業"],
        status: ["not_bidded", "not_started"],
        sort: [{ field: "bids", direction: "desc" }],
        page: 15,
        joinType: "AND",
      },
      flags: {
        hasCategories: true,
        hasStatus: true,
        hasSort: true,
        categoryCount: 3,
        statusValues: ["not_bidded", "not_started"],
        sortField: "bids",
        sortDirection: "desc",
        joinType: "AND" as const,
        page: 15,
      },
    },
    {
      name: "複合条件(検索クエリ + スコアソート + 最小入札額 + 特定グループ)",
      conditions: {
        searchQuery: "AI 機械学習",
        sort: [{ field: "score", direction: "desc" }],
        minBid: 1000,
        groupIds: ["test-group-id"],
        joinType: "OR",
      },
      flags: {
        hasSearchQuery: true,
        hasSort: true,
        hasMinBid: true,
        hasGroupIds: true,
        sortField: "score",
        sortDirection: "desc",
        joinType: "OR" as const,
      },
    },
    {
      name: "複合条件(すべてのカテゴリー + 価格ソート昇順 + 最大残り時間 + ページネーション)",
      conditions: {
        categories: ["すべて"],
        sort: [{ field: "price", direction: "asc" }],
        maxRemainingTime: 24,
        page: 7,
        joinType: "AND",
      },
      flags: {
        hasCategories: false, // "すべて"が含まれている場合はカテゴリー条件を追加しない
        hasSort: true,
        hasMaxRemainingTime: true,
        sortField: "price",
        sortDirection: "asc",
        joinType: "AND" as const,
        page: 7,
      },
    },
    {
      name: "複合条件(単一カテゴリー + ウォッチリスト + 新着順ソート + 最大入札額)",
      conditions: {
        categories: ["その他"],
        status: ["watchlist"],
        sort: [{ field: "newest", direction: "desc" }],
        maxBid: 3000,
        joinType: "OR",
      },
      flags: {
        hasCategories: true,
        hasStatus: true,
        hasSort: true,
        hasMaxBid: true,
        categoryCount: 1,
        statusValues: ["watchlist"],
        sortField: "newest",
        sortDirection: "desc",
        joinType: "OR" as const,
      },
    },
    {
      name: "複合条件(入札済み + 終了済み + 入札額範囲 + 残り時間範囲 + ページネーション)",
      conditions: {
        status: ["bidded", "ended"],
        minBid: 200,
        maxBid: 1500,
        minRemainingTime: 1,
        maxRemainingTime: 48,
        page: 12,
        joinType: "AND",
      },
      flags: {
        hasStatus: true,
        hasMinBid: true,
        hasMaxBid: true,
        hasMinRemainingTime: true,
        hasMaxRemainingTime: true,
        statusValues: ["bidded", "ended"],
        joinType: "AND" as const,
        page: 12,
      },
    },
  ];
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("cache-auction-listing.ts_cachedGetAuctionListingsAndCount", () => {
  describe("test.each()を使用した条件別SQLテスト", () => {
    // テストケースの定義
    const testCases = [
      {
        name: "デフォルト条件のみ",
        conditions: {},
        flags: {},
      },
      {
        name: "カテゴリーフィルター適用(デザイン, デザイン)",
        conditions: { categories: ["デザイン", "デザイン"] },
        flags: {
          hasCategories: true,
          categoryCount: 2,
        },
      },
      {
        name: "最小入札額フィルター適用",
        conditions: { minBid: 100 },
        flags: {
          hasMinBid: true,
        },
      },
      {
        name: "最大入札額フィルター適用",
        conditions: { maxBid: 1000 },
        flags: {
          hasMaxBid: true,
        },
      },
      {
        name: "入札額範囲フィルター適用",
        conditions: { minBid: 100, maxBid: 1000 },
        flags: {
          hasMinBid: true,
          hasMaxBid: true,
        },
      },
      {
        name: "検索クエリ適用",
        conditions: { searchQuery: "テスト クエリ" },
        flags: {
          hasSearchQuery: true,
        },
      },
      {
        name: "最小残り時間フィルター適用",
        conditions: { minRemainingTime: 24 },
        flags: {
          hasMinRemainingTime: true,
        },
      },
      {
        name: "最大残り時間フィルター適用",
        conditions: { maxRemainingTime: 168 },
        flags: {
          hasMaxRemainingTime: true,
        },
      },
      {
        name: "残り時間範囲フィルター適用",
        conditions: { minRemainingTime: 24, maxRemainingTime: 168 },
        flags: {
          hasMinRemainingTime: true,
          hasMaxRemainingTime: true,
        },
      },
      {
        name: "グループIDフィルター適用",
        conditions: { groupIds: ["test-group-id"] },
        flags: {
          hasGroupIds: true,
        },
      },
      {
        name: "ページネーション適用(1ページ目)",
        conditions: { page: 1 },
        flags: {},
      },
      {
        name: "ページネーション適用(10ページ目)",
        conditions: { page: 10 },
        flags: {
          page: 10,
        },
      },
      // カテゴリーの全組み合わせテストケースを追加
      ...generateSingleCategoryCombinations(),
      // 複数カテゴリーの組み合わせテストケースを追加
      ...generateMultipleCategoriesCombinations(),
      // ソート条件の全組み合わせテストケースを追加
      ...generateSortCombinations(),
      // 単一ステータスとjoinTypeの全組み合わせテストケースを追加
      ...generateSingleStatusJoinTypeCombinations(),
      // 複合条件のテストケースを追加
      ...generateComplexConditionsCombinations(),
      // ステータス2つの組み合わせとjoinTypeの全組み合わせテストケースを追加
      ...generateStatusJoinTypeCombinations(),
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
