"use server";
"use cache";

import { cache } from "react"; // Next.js 15+ のキャッシュ機能
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { AuctionStatus, Prisma } from "@prisma/client";

import type { AuctionCard, AuctionListingResult, AuctionListingsConditions, Suggestion } from "../type/types";
import { AUCTION_CONSTANTS } from "../constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 日本語テキストを正規化する関数 (例)
 * データベースに関数を作成する方が効率的
 * CREATE OR REPLACE FUNCTION normalize_japanese(text) RETURNS text AS $$
 * SELECT normalize(lower($1), nfkc);
 * $$ LANGUAGE sql IMMUTABLE;
 * @param text 正規化するテキスト
 * @returns 正規化されたテキスト
 */
function normalizeJapanese(text: string | null | undefined): string {
  if (!text) return "";
  // NFKC正規化と小文字化
  return text.normalize("NFKC").toLowerCase();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * buildRawQueryComponents の戻り値の型
 */
type BuildRawQueryComponentsReturn = {
  whereClauses: string[];
  ftsCondition: string;
  params: unknown[];
  paramIndex: number;
  keywords: string[];
  userIdParamIndex: number | null;
  userGroupIdsParamIndex: number | null;
  normalizedQueryParamIndex: number | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Raw SQLクエリのWHERE句、パラメータ、全文検索条件などを構築する共通ヘルパー関数
 * @param listingsConditions 検索条件
 * @returns WHERE句フラグメント、全文検索条件、パラメータ、次のパラメータインデックス、キーワード
 */
async function buildRawQueryComponents(listingsConditions: AuctionListingsConditions): Promise<BuildRawQueryComponentsReturn> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 引数を分解
   */
  const { categories, status, minBid, maxBid, minRemainingTime, maxRemainingTime, groupIds, statusConditionJoinType, searchQuery } =
    listingsConditions;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータとWHERE句を初期化
   */
  const params: unknown[] = [];
  const whereClauses: string[] = [];
  let ftsCondition = "";
  let keywords: string[] = [];
  let normalizedQueryParamIndex: number | null = null;
  let paramIndex = 1;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループIDを取得
   */
  const userGroupMemberships = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const userGroupIds = userGroupMemberships.map((gm) => gm.groupId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループがない場合、空の結果を返す
   */
  if (userGroupIds.length === 0) {
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_noUserGroups");
    return {
      whereClauses: ["1 = 0"],
      ftsCondition: "",
      params: [],
      paramIndex: 1,
      keywords: [],
      userIdParamIndex: null,
      userGroupIdsParamIndex: null,
      normalizedQueryParamIndex: null,
    }; // 参加グループがない場合は空
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 必須パラメータ: userId, userGroupIds
   */
  // $1
  params.push(userId);
  const userIdParamIndex = paramIndex;
  paramIndex++;
  // $2
  params.push(userGroupIds);
  const userGroupIdsParamIndex = paramIndex;
  paramIndex++;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 全文検索条件 (searchQuery がある場合)
   */
  if (searchQuery) {
    const normalizedQuery = normalizeJapanese(searchQuery);
    keywords = normalizedQuery.split(/\s+/).filter(Boolean);

    // $3
    params.push(normalizedQuery);
    normalizedQueryParamIndex = paramIndex;
    paramIndex++;
    // $4, $5, ...
    keywords.forEach((kw) => {
      params.push(kw);
      paramIndex++;
    });

    // 全文検索条件 (&@: 部分一致) - Task テーブル (エイリアス t)
    ftsCondition = `normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@ $${normalizedQueryParamIndex}`;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なWHERE条件
   */
  // グループID (ユーザーが所属するグループ)
  whereClauses.push(`a."group_id" = ANY($${userGroupIdsParamIndex}::text[])`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カテゴリー
   */
  if (categories && categories.length > 0 && !categories.includes("すべて")) {
    const validCategories = categories.filter((c) => c !== null && c !== "すべて");
    if (validCategories.length > 0) {
      whereClauses.push(`(${validCategories.map(() => `t.category ILIKE $${paramIndex++}`).join(" OR ")})`);
      params.push(...validCategories);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータス
   */
  if (status && status.length > 0) {
    const statusWhereClausesSql: string[] = [];
    const watchlistConditions: string[] = [];
    const bidConditions: string[] = [];

    status.forEach((statusItem) => {
      switch (statusItem) {
        case "watchlist":
          // is_watched は SELECT で計算済みなので WHERE で利用可能 (getAuctionListings)
          // COUNT(*) ではサブクエリが必要
          watchlistConditions.push(
            `EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = $${userIdParamIndex})`,
          );
          break;
        case "not_bidded":
          bidConditions.push(`NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = $${userIdParamIndex})`);
          break;
        case "bidded":
          bidConditions.push(`EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = $${userIdParamIndex})`);
          break;
        case "ended":
          statusWhereClausesSql.push(`a.status = $${paramIndex++}`);
          params.push(AuctionStatus.ENDED);
          break;
        case "not_ended":
          statusWhereClausesSql.push(`(a.status != $${paramIndex++} AND a."end_time" >= $${paramIndex++})`);
          params.push(AuctionStatus.ENDED, new Date());
          break;
        case "not_started":
          statusWhereClausesSql.push(`(a.status = $${paramIndex++} AND a."start_time" >= $${paramIndex++})`);
          params.push(AuctionStatus.PENDING, new Date());
          break;
        case "started":
          statusWhereClausesSql.push(`(a.status = $${paramIndex++} AND a."start_time" <= $${paramIndex++})`);
          params.push(AuctionStatus.ACTIVE, new Date());
          break;
      }
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ステータスの結合演算子
     */
    const joinOperator = statusConditionJoinType === "AND" ? " AND " : " OR ";

    // getAuctionListings では is_watched を SELECT で取得するので不要だが、getAuctionCount では必要なので、共通化のためにここで条件を追加する
    if (watchlistConditions.length > 0) {
      whereClauses.push(`(${watchlistConditions.join(joinOperator)})`);
    }
    if (bidConditions.length > 0) {
      whereClauses.push(`(${bidConditions.join(joinOperator)})`);
    }
    if (statusWhereClausesSql.length > 0) {
      whereClauses.push(`(${statusWhereClausesSql.join(joinOperator)})`);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札額
   */
  if (minBid !== null && minBid !== undefined) {
    whereClauses.push(`a."current_highest_bid" >= $${paramIndex++}`);
    params.push(minBid);
  }
  if (maxBid !== null && maxBid !== undefined && maxBid !== 0) {
    whereClauses.push(`a."current_highest_bid" <= $${paramIndex++}`);
    params.push(maxBid);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 残り時間
   */
  const now = new Date();
  if (minRemainingTime !== null && minRemainingTime !== undefined) {
    whereClauses.push(`a."end_time" >= $${paramIndex++}`);
    params.push(new Date(now.getTime() + minRemainingTime * 60 * 60 * 1000));
  }
  if (maxRemainingTime !== null && maxRemainingTime !== undefined && maxRemainingTime !== 0) {
    whereClauses.push(`a."end_time" <= $${paramIndex++}`);
    params.push(new Date(now.getTime() + maxRemainingTime * 60 * 60 * 1000));
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループID (URLパラメータで指定された場合) - userGroupIdsParamIndex を使って絞り込み
   */
  if (groupIds && groupIds.length > 0 && userGroupIdsParamIndex !== null) {
    // userGroupIds は $2 で既にフィルタリングされているので、
    // ここでは指定された groupIds のみが対象になるように追加条件を加える
    const allowedGroupIds = userGroupIds.filter((id) => groupIds.includes(id));
    if (allowedGroupIds.length > 0) {
      whereClauses.push(`a."group_id" = ANY($${paramIndex++}::text[])`);
      params.push(allowedGroupIds);
    } else {
      // 条件に合うグループがない場合は結果を0件にする false 条件を追加
      whereClauses.push("1 = 0");
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    whereClauses,
    ftsCondition,
    params,
    paramIndex,
    keywords,
    userIdParamIndex,
    userGroupIdsParamIndex,
    normalizedQueryParamIndex,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数の引数の型
 */
type GetAuctionListingsParams = {
  listingsConditions: AuctionListingsConditions;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数 (キャッシュ対応) - 常に $queryRaw を使用
 * @param params 取得パラメータ
 * @returns オークション一覧
 */
export const getAuctionListings = cache(async ({ listingsConditions }: GetAuctionListingsParams): Promise<AuctionListingResult> => {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ログ
     */
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_start (using $queryRaw)", { ...listingsConditions });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 引数を分解
     */
    const { sort, page, searchQuery } = listingsConditions;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリコンポーネントの構築
     */
    const {
      whereClauses,
      ftsCondition,
      params: baseParams, // Rename to avoid conflict
      paramIndex: baseParamIndex, // Rename to avoid conflict
      keywords,
      userIdParamIndex,
      // userGroupIdsParamIndex, // Not directly needed here, but available
      normalizedQueryParamIndex,
    } = await buildRawQueryComponents(listingsConditions);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーが参加しているグループがない場合、空の結果を返す
     */
    if (whereClauses.length > 0 && whereClauses[0] === "1 = 0") {
      console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_noUserGroups_参加Groupがないため、オークションを表示できません");
      return [];
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SELECT句の追加要素
     */
    let selectAdditions = "";
    if (searchQuery && normalizedQueryParamIndex !== null) {
      const highlightParams = keywords.map((_, i) => `$${normalizedQueryParamIndex + 1 + i}`).join(", ");
      // SELECT句にスコアとハイライトを追加
      selectAdditions = `
            , pgroonga_score(t.tableoid, t.ctid) as score
            , pgroonga_highlight_html(t.task, ${highlightParams}) as task_highlighted
            , pgroonga_highlight_html(t.detail, ${highlightParams}) as detail_highlighted
        `;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ORDER BY
     */
    let orderBySql = "";
    if (sort && sort.length > 0) {
      const primarySort = sort[0];
      const direction = primarySort.direction === "asc" ? "ASC" : "DESC";
      switch (primarySort.field) {
        case "relevance":
          if (searchQuery) orderBySql = `ORDER BY score DESC`;
          else orderBySql = `ORDER BY a."created_at" DESC`; // Fallback
          break;
        case "newest":
          orderBySql = `ORDER BY a."created_at" ${direction}`;
          break;
        case "time_remaining":
          orderBySql = `ORDER BY a."end_time" ${direction}`;
          break;
        case "bids":
          orderBySql = `ORDER BY "bids_count" ${direction}`;
          break; // Assumes bids_count is selected
        case "price":
          orderBySql = `ORDER BY a."current_highest_bid" ${direction}`;
          break;
        default:
          orderBySql = searchQuery ? `ORDER BY score DESC` : `ORDER BY a."created_at" DESC`;
          break;
      }
    } else {
      orderBySql = searchQuery ? `ORDER BY score DESC` : `ORDER BY a."created_at" DESC`;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * LIMIT / OFFSET パラメータ
     */
    const pageNumber = page ?? 1;
    const skip = (pageNumber - 1) * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
    const take = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
    const finalParams = [...baseParams]; // Copy base parameters
    let currentParamIndex = baseParamIndex; // Start from the next available index
    finalParams.push(take); // LIMIT
    const limitParamIndex = currentParamIndex++;
    finalParams.push(skip); // OFFSET
    const offsetParamIndex = currentParamIndex++;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * WHERE句の結合
     */
    const finalWhereClauses = [];
    if (ftsCondition) {
      finalWhereClauses.push(ftsCondition);
    }
    // Add other where clauses generated by buildRawQueryComponents
    finalWhereClauses.push(...whereClauses);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQL クエリの組み立て
     */
    const sql = Prisma.sql`
        SELECT
            a.id as "id",
            a."current_highest_bid" as "current_highest_bid",
            a."end_time" as "end_time",
            a."start_time" as "start_time",
            a.status as "status",
            a."created_at" as "created_at",
            t.task as "task",
            t.detail as "detail",
            t."image_url" as "image_url",
            t.category as "category",
            g.id as "group_id",
            g.name as "group_name",
            (
              SELECT COUNT(*)
              FROM "BidHistory" bh
              WHERE bh."auction_id" = a.id
            )::bigint as "bids_count",
            (
              SELECT COUNT(*)
              FROM "TaskWatchList" twl
              WHERE twl."auction_id" = a.id
              AND twl."user_id" = $${userIdParamIndex}
            ) > 0 as "is_watched",
            (
              SELECT json_agg(json_build_object(
                'id', te.id,
                'user_id', u.id,
                'user_image', u.image,
                'username', us.username,
                'rating', COALESCE((SELECT AVG(r.rating) FROM "AuctionReview" r WHERE r."reviewee_id" = u.id), 0)
              ))
              FROM "TaskExecutor" te
              JOIN "User" u ON te."user_id" = u.id
              LEFT JOIN "UserSettings" us ON u.id = us."user_id"
              WHERE te."task_id" = a."task_id"
            )::text as "executors_json",
            ${Prisma.raw(selectAdditions)}
        FROM
            "Auction" a
        JOIN
            "Task" t ON a."task_id" = t.id
        JOIN
            "Group" g ON a."group_id" = g.id
        WHERE ${Prisma.raw(finalWhereClauses.join(" AND "))}
        ${Prisma.raw(orderBySql)}
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    console.log("Executing Raw SQL:", sql);
    console.log("With Params:", finalParams);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Rawクエリ実行
     */
    const auctionsData: AuctionListingResult = await prisma.$queryRaw<AuctionListingResult>(sql, ...finalParams);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形 (共通処理)
     */
    const items: AuctionListingResult = auctionsData.map((auction) => {
      let taskExecutors: AuctionCard["executors_json"] = []; // 初期値は空配列 (object[])

      // executors_json が存在し、かつ string 型の場合のみパース処理を行う
      if (auction.executors_json && typeof auction.executors_json === "string") {
        try {
          // SQLクエリの json_build_object に対応する型
          // string 型であることが保証されているので安全にパースできる
          const parsedExecutors = JSON.parse(auction.executors_json) as AuctionCard["executors_json"];
          if (Array.isArray(parsedExecutors)) {
            // パース結果が配列であることを確認してから map を実行
            taskExecutors = parsedExecutors.map((exec) => ({
              id: exec.id,
              rating: exec.rating ?? null,
              userId: exec.userId ?? null, // JSON内の 'user_id' を 'userId' にマッピング
              userImage: exec.userImage ?? null, // JSON内の 'user_image' を 'userImage' にマッピング
              userSettingsUsername: exec.userSettingsUsername ?? "未設定", // JSON内の 'username' を 'userSettingsUsername' にマッピング
            }));
            // ここで taskExecutors は object[] 型になる
          }
        } catch (e) {
          // JSONパースに失敗した場合のエラーハンドリング
          console.error("Failed to parse taskExecutors_json", e, auction.executors_json);
          // パース失敗時は安全のため空配列を維持
          taskExecutors = [];
        }
      } else if (Array.isArray(auction.executors_json)) {
        // もし auction.executors_json が string ではなく object[] の場合
        // (型定義上はあり得るが、SQL の ::text キャストにより通常は string)
        // 型安全のため、そのまま代入する
        taskExecutors = auction.executors_json;
      }
      // executors_json が null や undefined の場合、または string でも array でもない場合は、
      // 初期値の空配列 [] が使用される

      return {
        id: auction.id,
        current_highest_bid: auction.current_highest_bid,
        end_time: auction.end_time,
        start_time: auction.start_time,
        status: auction.status,
        bids_count: Number(auction.bids_count), // bigint から number へ変換
        is_watched: !!auction.is_watched, // boolean 型であることを保証
        group_id: auction.group_id,
        group_name: auction.group_name,
        task: auction.task,
        detail: auction.detail,
        image_url: auction.image_url,
        category: auction.category,
        // taskExecutors はこの時点で object[] 型になっている
        // AuctionCard["executors_json"] (object[] | string) に代入可能
        executors_json: taskExecutors,
        // 全文検索関連のプロパティ (存在する場合のみ)
        task_highlighted: auction.task_highlighted ?? null,
        detail_highlighted: auction.detail_highlighted ?? null,
        score: auction.score ?? null,
      };
    });

    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_success", { itemsCount: items.length });
    return items;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーハンドリング
     */
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionListings_error", error);
    throw error;
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション件数取得関数 (キャッシュ対応) - $queryRaw を使用するように修正
 */
export const getAuctionCount = cache(async ({ listingsConditions }: GetAuctionListingsParams): Promise<number> => {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ログ
     */
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_start (using $queryRaw)", { ...listingsConditions });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリコンポーネントの構築
     */
    const { whereClauses, ftsCondition, params } = await buildRawQueryComponents(listingsConditions);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーが参加しているグループがない場合、0件を返す
     */
    if (whereClauses.length > 0 && whereClauses[0] === "1 = 0") return 0;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * WHERE句の結合
     */
    const finalWhereClauses = [];
    if (ftsCondition) {
      finalWhereClauses.push(ftsCondition);
    }
    finalWhereClauses.push(...whereClauses);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQL クエリの組み立て
     */
    const sql = Prisma.sql`
            SELECT COUNT(*)::bigint as count
            FROM "Auction" a
            JOIN "Task" t ON a."task_id" = t.id
            WHERE ${Prisma.raw(finalWhereClauses.join(" AND "))}
        `;

    console.log("Executing Raw Count SQL:", sql);
    console.log("With Count Params:", params);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Rawクエリ実行
     */
    const result = await prisma.$queryRaw<{ count: bigint }[]>(sql, ...params);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形
     */
    const count = result?.[0]?.count ?? BigInt(0);
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_success", { count: Number(count) });
    return Number(count);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーハンドリング
     */
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionCount_error", error);
    return 0; // エラー時は0件
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索提案取得関数 (キャッシュ対応)
 * @param query 検索クエリ
 * @param limit 取得件数
 * @returns オークション検索提案
 */
export const getSearchSuggestions = cache(async (query: string, limit = 10): Promise<Suggestion[]> => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 最低1文字以上で検索
   */
  if (!query || query.trim().length < 1) {
    return [];
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const userId = await getAuthenticatedSessionUserId();
  const userGroupMemberships = await prisma.groupMembership.findMany({ where: { userId }, select: { groupId: true } });
  const userGroupIds = userGroupMemberships.map((gm) => gm.groupId);
  if (userGroupIds.length === 0) return [];

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリの正規化
     */
    const normalizedQuery = normalizeJapanese(query);
    // 前方一致 (&^) を使用
    const sql = Prisma.sql`
        SELECT
          t.id,
          t.task as text,
          pgroonga_score(t.tableoid, t.ctid) as score,
          pgroonga_highlight_html(t.task, ${normalizedQuery}) as highlighted
        FROM
          "Task" t
        JOIN "Auction" a ON t.id = a."task_id"
        WHERE
          normalize_japanese(t.task) &^ ${normalizedQuery}
        AND
          a."group_id" = ANY(${userGroupIds}::text[])
        ORDER BY
          score DESC
        LIMIT
          ${limit}
      `;

    const suggestions: Suggestion[] = await prisma.$queryRaw<Suggestion[]>(sql);

    console.log("src/lib/auction/action/auction-listing.ts_getSearchSuggestions_success", { query, count: suggestions.length });
    return suggestions;
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getSearchSuggestions_error", error);
    return [];
  }
});
