"use cache";

import { cache } from "react"; // Next.js 15+ のキャッシュ機能
import { prisma } from "@/lib/prisma";
import { AuctionStatus, Prisma } from "@prisma/client";

import type { AuctionCard, AuctionListingResult, AuctionListingsConditions, Suggestion } from "../type/types";
import { AUCTION_CONSTANTS } from "../constants";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * buildRawQueryComponents の戻り値の型
 */
type BuildRawQueryComponentsReturn = {
  whereClauses: Prisma.Sql[];
  ftsCondition: Prisma.Sql;
  keywords: string[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Raw SQLクエリのWHERE句、パラメータ、全文検索条件などを構築する共通ヘルパー関数
 * @param listingsConditions 検索条件
 * @returns WHERE句フラグメント、全文検索条件、パラメータ、次のパラメータインデックス、キーワード
 */
async function buildRawQueryComponents(listingsConditions: AuctionListingsConditions, userId: string): Promise<BuildRawQueryComponentsReturn> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 引数を分解
   */
  const { categories, status, minBid, maxBid, minRemainingTime, maxRemainingTime, groupIds, statusConditionJoinType, searchQuery } =
    listingsConditions;
  console.log("src/lib/auction/action/cache-auction-listing.ts_buildRawQueryComponents_listingsConditions", listingsConditions);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータとWHERE句を初期化
   */
  const whereClauses: Prisma.Sql[] = [];
  let ftsCondition: Prisma.Sql = Prisma.empty;
  const keywords: string[] = [];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループIDを取得
   */
  const userGroupMemberships = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const userGroupIds = userGroupMemberships.map((gm) => gm.groupId);

  // コンソール
  console.log("src/lib/auction/action/cache-auction-listing.ts_buildRawQueryComponents_userGroupIds", userGroupIds);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループがない場合、空の結果を返す
   */
  if (userGroupIds.length === 0) {
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_noUserGroups");
    return {
      whereClauses: [Prisma.empty],
      ftsCondition: Prisma.empty,
      keywords: [],
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 全文検索条件 (searchQuery がある場合)
   */
  let normalizedQuery: string | null = null;
  if (searchQuery) {
    // 全文検索条件 (&@: 部分一致) - Task テーブル (エイリアス t)
    normalizedQuery = searchQuery.trim().replace(/\s+/g, " OR ");
    ftsCondition = Prisma.sql`public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ${normalizedQuery}`;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なWHERE条件
   */
  // グループID (ユーザーが所属するグループ)
  whereClauses.push(Prisma.sql`a."group_id" = ANY(${userGroupIds}::text[])`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カテゴリー
   */
  if (categories && categories.length > 0 && !categories.includes("すべて")) {
    const validCategories = categories.filter((c) => c !== null && c !== "すべて");
    if (validCategories.length > 0) {
      const catClauses = validCategories.map((c) => Prisma.sql`t.category ILIKE ${"%" + c + "%"}`);
      whereClauses.push(Prisma.sql`(${Prisma.join(catClauses, " OR ")})`);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステータス
   */
  if (status && status.length > 0) {
    const statusWhereClausesSql: Prisma.Sql[] = [];
    const watchlistConditions: Prisma.Sql[] = [];
    const bidConditions: Prisma.Sql[] = [];
    // 現在時刻を一度だけ取得
    const now = new Date();

    status.forEach((statusItem) => {
      switch (statusItem) {
        case "watchlist":
          // getAuctionCount 用の条件 (getAuctionListings では JOIN で処理)
          // パラメータインデックス $1 (userId) を使用
          watchlistConditions.push(
            Prisma.sql`EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = ${userId})`,
          );
          break;
        case "not_bidded":
          // getAuctionCount 用の条件
          // パラメータインデックス $1 (userId) を使用
          bidConditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ${userId})`);
          break;
        case "bidded":
          // getAuctionCount 用の条件
          // パラメータインデックス $1 (userId) を使用
          bidConditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ${userId})`);
          break;
        case "ended":
          // Prisma.sql`${AuctionStatus.ENDED}` を使用
          statusWhereClausesSql.push(Prisma.sql`a.status::text = ${AuctionStatus.ENDED}`);
          break;
        case "not_ended":
          // Prisma.sql`${now}` を使用
          statusWhereClausesSql.push(Prisma.sql`(a.status::text != ${AuctionStatus.ENDED} AND a."end_time" >= ${now})`);
          break;
        case "not_started":
          // Prisma.sql`${now}` を使用
          statusWhereClausesSql.push(Prisma.sql`(a.status::text = ${AuctionStatus.PENDING} AND a."start_time" >= ${now})`);
          break;
        case "started":
          // Prisma.sql`${now}` を使用
          statusWhereClausesSql.push(Prisma.sql`(a.status::text = ${AuctionStatus.ACTIVE} AND a."start_time" <= ${now})`);
          break;
      }
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ステータスの結合演算子
     */
    const joinOperatorString = statusConditionJoinType === "AND" ? " AND " : " OR ";

    // 各条件グループを結合して whereClauses に追加
    const combinedStatusConditions: Prisma.Sql[] = [];
    if (watchlistConditions.length > 0) {
      combinedStatusConditions.push(Prisma.sql`(${Prisma.join(watchlistConditions, joinOperatorString)})`);
    }
    if (bidConditions.length > 0) {
      combinedStatusConditions.push(Prisma.sql`(${Prisma.join(bidConditions, joinOperatorString)})`);
    }
    if (statusWhereClausesSql.length > 0) {
      combinedStatusConditions.push(Prisma.sql`(${Prisma.join(statusWhereClausesSql, joinOperatorString)})`);
    }

    // 最終的なステータス条件を AND で結合 (statusConditionJoinType は各グループ内の結合方法)
    if (combinedStatusConditions.length > 0) {
      whereClauses.push(Prisma.sql`(${Prisma.join(combinedStatusConditions, " AND ")})`);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 入札額
   */
  if (minBid !== null && minBid !== undefined) {
    // Prisma.sql`${minBid}` を使用
    whereClauses.push(Prisma.sql`a."current_highest_bid" >= ${minBid}`);
  }
  if (maxBid !== null && maxBid !== undefined && maxBid !== 0) {
    // Prisma.sql`${maxBid}` を使用
    whereClauses.push(Prisma.sql`a."current_highest_bid" <= ${maxBid}`);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 残り時間
   */
  const nowForRemainingTime = new Date(); // 残り時間計算用の現在時刻
  if (minRemainingTime !== null && minRemainingTime !== undefined) {
    // end_time が (現在時刻 + minRemainingTime時間) 以降
    const minEndTime = new Date(nowForRemainingTime.getTime() + minRemainingTime * 60 * 60 * 1000);
    // Prisma.sql`${minEndTime}` を使用
    whereClauses.push(Prisma.sql`a."end_time" >= ${minEndTime}`);
  }
  if (maxRemainingTime !== null && maxRemainingTime !== undefined && maxRemainingTime !== 0) {
    // end_time が (現在時刻 + maxRemainingTime時間) 以前
    const maxEndTime = new Date(nowForRemainingTime.getTime() + maxRemainingTime * 60 * 60 * 1000);
    // Prisma.sql`${maxEndTime}` を使用
    whereClauses.push(Prisma.sql`a."end_time" <= ${maxEndTime}`);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループID (URLパラメータで指定された場合) - userGroupIdsParamIndex を使って絞り込み
   */
  if (groupIds && groupIds.length > 0) {
    // ユーザーが所属し、かつURLパラメータで指定されたグループに絞り込む
    const allowedGroupIds = userGroupIds.filter((id) => groupIds.includes(id));
    if (allowedGroupIds.length > 0) {
      // 既存の $2 条件に加えて、さらに絞り込む
      whereClauses.push(Prisma.sql`a."group_id" = ANY(${allowedGroupIds}::text[])`);
    } else {
      // 条件に合うグループがない場合は結果を0件にする false 条件を追加
      whereClauses.push(Prisma.sql`1 = 0`);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // コンソール
  console.log("src/lib/auction/action/cache-auction-listing.ts_buildRawQueryComponents_whereClauses", whereClauses);
  console.log("src/lib/auction/action/cache-auction-listing.ts_buildRawQueryComponents_ftsCondition", ftsCondition);
  console.log("src/lib/auction/action/cache-auction-listing.ts_buildRawQueryComponents_keywords", keywords);

  /**
   * 戻り値
   */
  return {
    whereClauses,
    ftsCondition,
    keywords,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数の引数の型
 */
export type GetAuctionListingsParams = {
  listingsConditions: AuctionListingsConditions;
  userId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Raw クエリの戻り値の型を定義
type RawAuctionData = {
  id: string;
  current_highest_bid: number;
  end_time: Date;
  start_time: Date;
  status: AuctionStatus; // Prisma Client の型を使用
  created_at: Date;
  task: string;
  detail: string | null;
  image_url: string | null;
  category: string | null;
  group_id: string;
  group_name: string;
  bids_count: bigint | null; // DBからは bigint で返ってくる可能性がある
  is_watched: boolean | null; // DBからは boolean または null で返ってくる可能性がある
  executors_json: string | null; // CTEで json_agg(...)::text としているため string or null
  score: number | null;
  task_highlighted: string | null;
  detail_highlighted: string | null;
  _dummy: boolean; // ダミー列 (クエリに含まれている場合)
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数 (キャッシュ対応) - 常に $queryRaw を使用
 * @param params 取得パラメータ
 * @returns オークション一覧
 */
export const cachedGetAuctionListings = cache(async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<AuctionListingResult> => {
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
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings", sort, page, searchQuery);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリコンポーネントの構築
     */
    const { whereClauses, ftsCondition, keywords } = await buildRawQueryComponents(listingsConditions, userId);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_whereClauses", whereClauses);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_ftsCondition", ftsCondition);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_keywords", keywords);

    // ユーザーが参加可能なグループがない場合は即座に空配列を返す
    if (whereClauses.some((c) => c.sql === "1 = 0")) {
      console.log(
        "src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_noUserGroups_参加Groupがないため、オークションを表示できません",
      );
      return [];
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 全文検索関連の準備 (スコア、ハイライト)
     */
    // 全文検索のSELECT句
    let ftsSelectSQL: Prisma.Sql = Prisma.empty;
    // 全文検索のORDER BY句
    let ftsOrderBySQL: Prisma.Sql = Prisma.empty;
    // ハイライト用パラメータ
    let highlightParamsSQL: Prisma.Sql = Prisma.empty;
    // ハイライト用パラメータのインデックス
    const highlightParamIndices: Prisma.Sql[] = [];
    // ハイライト用SQL
    let ftsHighlightTaskSQL: Prisma.Sql = Prisma.empty;
    // ハイライト用SQL
    let ftsHighlightDetailSQL: Prisma.Sql = Prisma.empty;

    /**
     * 全文検索関連の準備 (スコア、ハイライト)
     */
    // 全文検索がある場合
    if (searchQuery && keywords.length > 0) {
      // スコア計算
      ftsSelectSQL = Prisma.sql`, pgroonga_score(t.tableoid, t.ctid) as score`;
      // ハイライト (キーワードごとにパラメータを追加)
      keywords.forEach((kw) => {
        highlightParamIndices.push(Prisma.sql`${kw}`);
      });
      // ハイライト用パラメータの文字列
      highlightParamsSQL = Prisma.sql`pgroonga_query_extract_keywords(${keywords.map((k) => `${k}`).join(" OR ")})`;
      // ハイライト (キーワードごとにパラメータを追加)
      ftsHighlightTaskSQL = Prisma.sql`, pgroonga_highlight_html(t.task, ${highlightParamsSQL}) as task_highlighted`;
      ftsHighlightDetailSQL = Prisma.sql`, pgroonga_highlight_html(t.detail, ${highlightParamsSQL}) as detail_highlighted`;
      // FTS検索時はスコアでソートを優先する場合が多い
      ftsOrderBySQL = Prisma.sql`score DESC`;

      // コンソール
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_ftsSelectSQL (score only)", ftsSelectSQL);
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_ftsCondition", ftsCondition);
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_ftsOrderBySQL", ftsOrderBySQL);
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_highlightParamsSQL", highlightParamsSQL);
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_ftsHighlightTaskSQL", ftsHighlightTaskSQL);
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_ftsHighlightDetailSQL", ftsHighlightDetailSQL);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ソート順の決定
     */
    // ソート順のSQL
    let orderBySql: Prisma.Sql = Prisma.empty;
    // デフォルトソート順を定義 (FTS検索がない場合は作成日時降順)
    const defaultSort = ftsOrderBySQL !== Prisma.empty ? ftsOrderBySQL : Prisma.sql`a."created_at" DESC`;

    if (sort && sort.length > 0) {
      const primarySort = sort[0];
      // Prisma.sql を使用して安全に方向を構築
      const directionSql = primarySort.direction === "asc" ? Prisma.sql`ASC NULLS LAST` : Prisma.sql`DESC NULLS LAST`;

      switch (primarySort.field) {
        case "relevance":
          // FTS検索がない場合はデフォルトソートを使用
          orderBySql = ftsOrderBySQL !== Prisma.empty ? ftsOrderBySQL : defaultSort;
          break;
        case "newest":
          orderBySql = Prisma.sql`a."created_at" ${directionSql}`;
          break;
        case "time_remaining":
          orderBySql = Prisma.sql`a."end_time" ${directionSql}`;
          break;
        case "bids":
          // bids_count_intermediate は FilteredAuctionsCTE で定義される
          orderBySql = Prisma.sql`"bids_count_intermediate" ${directionSql}`;
          break;
        case "price":
          orderBySql = Prisma.sql`a."current_highest_bid" ${directionSql}`;
          break;
        default:
          orderBySql = defaultSort;
          break;
      }
    } else {
      // sort パラメータがない場合はデフォルトソートを使用
      orderBySql = defaultSort;
    }

    // bids でソートする場合、bids_count をCTE内で計算してソートキーに含める
    let bidsCountSelectForSort: Prisma.Sql = Prisma.empty;
    // primarySort.field を直接チェックする方が安全
    if (sort && sort.length > 0 && sort[0].field === "bids") {
      bidsCountSelectForSort = Prisma.sql`
        , (SELECT COUNT(*) FROM "BidHistory" bh_sort WHERE bh_sort."auction_id" = a.id) as bids_count_intermediate
      `;
    }

    // コンソールログはそのまま
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_orderBySql", orderBySql);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_bidsCountSelectForSort", bidsCountSelectForSort);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ページネーションパラメータの追加
     */
    // ページ番号
    const pageNumber = page ?? 1;
    // スキップ
    const skip = (pageNumber - 1) * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
    // 取得数
    const take = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;

    // コンソール
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_pageNumber", pageNumber);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_skip", skip);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_take", take);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * WHERE句の結合
     */
    // whereClauses には group_id, category, status(EXISTS), price, time などが含まれる
    // ftsWhereSQL には全文検索条件が含まれる
    const finalWhereClause: Prisma.Sql = Prisma.join(
      [ftsCondition, ...whereClauses].filter((s) => s !== Prisma.empty),
      " AND ",
    );
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_finalWhereClause", finalWhereClause);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    // 修正: ORDER BY 句を条件付きで生成
    const orderByClause = orderBySql !== Prisma.empty ? Prisma.sql`ORDER BY ${orderBySql}` : Prisma.empty;
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_orderByClause", orderByClause);
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQLクエリの組み立て (CTEを使用)
     */
    const sql: Prisma.Sql = Prisma.sql`
      WITH "FilteredAuctionsCTE" AS (
        -- ステップ1: フィルタリングとソート (スコア計算を含む)
        SELECT
          a.id,
          a."task_id",
          a."created_at", -- ソート用
          a."end_time",   -- ソート用
          a."current_highest_bid" -- ソート用
          ${bidsCountSelectForSort} -- bids ソート用の中間カウント
          ${ftsSelectSQL} -- スコア計算 (FTS時)
        FROM "Auction" a
        JOIN "Task" t ON a."task_id" = t.id
        ${finalWhereClause !== Prisma.empty ? Prisma.sql`WHERE ${finalWhereClause}` : Prisma.empty}
        ${orderByClause} -- 修正: 条件付きで生成した ORDER BY 句を使用
      ),
      "PaginatedAuctionsCTE" AS (
        -- ステップ2: ページネーションの適用
        SELECT id, task_id ${ftsSelectSQL !== Prisma.empty ? Prisma.sql`, score` : Prisma.empty} -- scoreも選択
        FROM "FilteredAuctionsCTE"
        LIMIT ${take} OFFSET ${skip}
      ),
      "BidsCountCTE" AS (
        -- ステップ3: ページ内のオークションの入札数を計算
        SELECT
          bh."auction_id",
          COUNT(bh.id)::bigint as "bids_count"
        FROM "BidHistory" bh
        WHERE bh."auction_id" IN (SELECT id FROM "PaginatedAuctionsCTE")
        GROUP BY bh."auction_id"
      ),
      "WatchlistCTE" AS (
        -- ステップ4: ページ内のオークションのウォッチリスト登録状況を確認 (指定ユーザー)
        SELECT
          twl."auction_id",
          TRUE as "is_watched"
        FROM "TaskWatchList" twl
        WHERE twl."auction_id" IN (SELECT id FROM "PaginatedAuctionsCTE")
          AND twl."user_id" = ${userId}
      ),
      "ExecutorsCTE" AS (
        -- ステップ5: ページ内のオークションの実行者情報を集約
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
      -- 最終ステップ: 全ての情報を結合して取得
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
          COALESCE(bc.bids_count, 0) as "bids_count",
          COALESCE(wc.is_watched, FALSE) as "is_watched",
          ex.executors_json
          ${ftsSelectSQL !== Prisma.empty ? Prisma.sql`, p.score as score` : Prisma.empty} -- PaginatedAuctionsCTE からスコアを取得 (エイリアス p)
          ${ftsHighlightTaskSQL}    -- タスクハイライト
          ${ftsHighlightDetailSQL}  -- 詳細ハイライト
      FROM "PaginatedAuctionsCTE" p -- PaginatedAuctionsCTE にエイリアス p を設定
      JOIN "Auction" a ON p.id = a.id
      JOIN "Task" t ON a."task_id" = t.id
      JOIN "Group" g ON a."group_id" = g.id
      LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
      LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
      LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id
      ;
    `;

    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_sql", sql);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Rawクエリ実行と型適用
     */
    const auctionsData: RawAuctionData[] = await prisma.$queryRaw(sql);

    // コンソール
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_auctionsData", auctionsData);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形 (型の適用)
     */
    const items: AuctionListingResult = auctionsData.map<AuctionCard>((auction: RawAuctionData): AuctionCard => {
      // mapの引数と戻り値に型を指定
      // AuctionCard の executors_json の配列要素の型を定義
      type ExecutorJsonItem = {
        id: string | null;
        rating: number | null;
        userId: string | null;
        userImage: string | null;
        userSettingsUsername: string | null;
      };

      // taskExecutors の型を ExecutorJsonItem[] に修正
      let taskExecutors: ExecutorJsonItem[] = [];
      if (auction.executors_json && typeof auction.executors_json === "string") {
        try {
          const parsedExecutorsUnknown: unknown = JSON.parse(auction.executors_json); // unknown で受け取る
          // パース結果が配列であることを確認
          if (Array.isArray(parsedExecutorsUnknown)) {
            const parsedExecutors = parsedExecutorsUnknown as unknown[]; // unknown[] にアサーション

            // DB からの JSON オブジェクトの型を定義
            type ExecutorJsonItemFromDB = {
              id: string | null;
              user_id: string | null; // DB のキー
              user_image: string | null; // DB のキー
              username: string | null; // DB のキー
              rating: number | null;
            };

            // 型ガード関数 (DB からの JSON オブジェクトの構造と型をチェック)
            const isExecutorObjectFromDB = (obj: unknown): obj is ExecutorJsonItemFromDB => {
              // obj が null でなく、オブジェクト型であることをまず確認
              if (typeof obj !== "object" || obj === null) {
                return false;
              }
              // 各プロパティの存在と型を安全にチェック
              const potentialExec = obj as Record<string, unknown>; // 型アサーションでプロパティアクセスを可能に
              return (
                "id" in potentialExec &&
                (typeof potentialExec.id === "string" || potentialExec.id === null) &&
                "user_id" in potentialExec &&
                (typeof potentialExec.user_id === "string" || potentialExec.user_id === null) &&
                "user_image" in potentialExec &&
                (typeof potentialExec.user_image === "string" || potentialExec.user_image === null) &&
                "username" in potentialExec &&
                (typeof potentialExec.username === "string" || potentialExec.username === null) &&
                "rating" in potentialExec &&
                (typeof potentialExec.rating === "number" || potentialExec.rating === null)
              );
            };

            // 配列の要素が期待する型を持つかチェックしながらマッピング
            taskExecutors = parsedExecutors
              .map((exec: unknown): ExecutorJsonItem | null => {
                // 戻り値の型を明示
                // 修正した型ガードを使用
                if (isExecutorObjectFromDB(exec)) {
                  // 型ガードにより exec は ExecutorJsonItemFromDB 型として扱える
                  // AuctionCard の型 (ExecutorJsonItem) に合わせて変換
                  return {
                    id: exec.id,
                    rating: exec.rating,
                    userId: exec.user_id, // DB のキー 'user_id' を 'userId' に変換
                    userImage: exec.user_image, // DB のキー 'user_image' を 'userImage' に変換
                    userSettingsUsername: exec.username ?? "未設定", // DB のキー 'username' を 'userSettingsUsername' に変換
                  };
                }
                return null; // オブジェクトでない or 型ガードで弾かれた場合は null を返す (後でフィルタリング)
              })
              .filter((exec): exec is ExecutorJsonItem => exec !== null); // null を除去し、型を確定 (ExecutorJsonItem)
          }
        } catch (e) {
          console.error("Failed to parse taskExecutors_json", e, auction.executors_json);
          taskExecutors = []; // パース失敗時は空配列
        }
      }

      return {
        id: auction.id,
        current_highest_bid: auction.current_highest_bid,
        end_time: auction.end_time,
        start_time: auction.start_time,
        status: auction.status,
        bids_count: Number(auction.bids_count ?? 0), // bigintからnumberへ、NULLなら0
        is_watched: !!auction.is_watched, // boolean型を保証 (null/undefined -> false)
        group_id: auction.group_id,
        group_name: auction.group_name,
        task: auction.task,
        detail: auction.detail,
        image_url: auction.image_url,
        category: auction.category,
        executors_json: taskExecutors as AuctionCard["executors_json"],
        task_highlighted: auction.task_highlighted ?? null,
        detail_highlighted: auction.detail_highlighted ?? null,
        score: auction.score ?? null,
      } as AuctionCard; // オブジェクト全体をキャスト
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * コンソール
     */
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_success", items);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果を返す
     */
    return items;
  } catch (error) {
    console.error("src/lib/auction/action/cache-auction-listing.ts_getAuctionListings_error", error);
    return []; // 空の結果を返す場合
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション件数取得関数 (キャッシュ対応) - $queryRaw を使用するように修正
 */
export const cachedGetAuctionCount = cache(async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<number> => {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * コンソール
     */
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionCount_start", { ...listingsConditions });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * クエリコンポーネントの構築 (WHERE句、基本パラメータ)
     */
    const { whereClauses, ftsCondition } = await buildRawQueryComponents(listingsConditions, userId);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーが参加可能なグループがない場合は0件
     */
    if (whereClauses.includes(Prisma.sql`1 = 0`)) {
      console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionCount_noUserGroups");
      return 0;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * WHERE句の結合
     */
    const finalWhereClauses: Prisma.Sql[] = [];
    // 全文検索条件がある場合は追加
    if (ftsCondition && ftsCondition !== Prisma.empty) {
      finalWhereClauses.push(ftsCondition);
    }
    // WHERE句の結合
    finalWhereClauses.push(...whereClauses.filter((c) => c !== Prisma.empty));

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQL クエリの組み立て (COUNT)
     */
    // Task テーブルへの JOIN は、カテゴリや全文検索の条件がある場合に必要
    const needsTaskJoin = finalWhereClauses.some((c) => c.sql.includes("t.") || c === ftsCondition);
    const joinClause = needsTaskJoin ? Prisma.sql`JOIN "Task" t ON a."task_id" = t.id` : Prisma.empty;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * SQL クエリの組み立て (COUNT)
     */
    const sql = Prisma.sql`
            SELECT COUNT(*)::bigint as count
            FROM "Auction" a
            ${joinClause}
            ${finalWhereClauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(finalWhereClauses, " AND ")}` : Prisma.empty}
        `;

    // コンソール
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionCount_sql", sql);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Rawクエリ実行
     */
    const result = await prisma.$queryRaw<{ count: bigint }[]>(sql);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形
     */
    const count = Number(result?.[0]?.count ?? BigInt(0));
    console.log("src/lib/auction/action/cache-auction-listing.ts_getAuctionCount_result", count);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形
     */
    return count;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("src/lib/auction/action/cache-auction-listing.ts_getAuctionCount_error", error);
    return 0; // エラー時は0件
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索提案取得関数
 * @param query 検索クエリ
 * @param limit 取得件数
 * @returns オークション検索提案
 */
export const cachedGetSearchSuggestions = cache(async (query: string, userId: string, limit = 10): Promise<Suggestion[]> => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_start", query);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリがない場合は空配列を返す
   */
  if (!query || query.trim().length < 1) {
    return [];
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが所属するグループのIDを取得
   */
  const userGroupMemberships = await prisma.groupMembership.findMany({ where: { userId }, select: { groupId: true } });
  const userGroupIds = userGroupMemberships.map((gm) => gm.groupId);
  if (userGroupIds.length === 0) {
    console.log("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_noUserGroupIds");
    return [];
  }

  const normalizedQuery = query.trim().replace(/\s+/g, " OR ");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * SQL クエリの組み立て
   * pgroonga の前方一致 (&^) を使用
   */
  try {
    const sql = Prisma.sql`
        SELECT
          t.id,
          t.task as text,
          t.detail as detail,
          pgroonga_score(t.tableoid, t.ctid) as score,
          pgroonga_highlight_html(t.task, ARRAY[${query}]) as highlighted
        FROM
          "Task" t
        JOIN
          "Auction" a ON t.id = a."task_id"
        WHERE
          public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ${normalizedQuery} -- task と detail を結合して検索
        AND
          a."group_id" = ANY(${userGroupIds}::text[]) -- ユーザーが所属するグループのオークションのみ
        ORDER BY
          score DESC
        LIMIT
          ${limit}
      `;
    console.log("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_sql", sql);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Rawクエリ実行
     */
    const suggestions: Suggestion[] = await prisma.$queryRaw<Suggestion[]>(sql);
    console.log("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_suggestions", suggestions);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * コンソール
     */
    console.log("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_success", { query, count: suggestions.length });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果の整形
     */
    return suggestions;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("src/lib/auction/action/cache-auction-listing.ts_getSearchSuggestions_error", error);
    return [];
  }
});
