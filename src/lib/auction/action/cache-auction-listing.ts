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
  whereClauses: string[];
  ftsCondition: string;
  params: unknown[];
  paramIndex: number;
  keywords: string[];
  userIdParamIndex: number | null;
  userGroupIdsParamIndex: number | null;
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータとWHERE句を初期化
   */
  const params: unknown[] = [];
  const whereClauses: string[] = [];
  let ftsCondition = "";
  let keywords: string[] = [];
  let paramIndex = 1;

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
    keywords = searchQuery.split(/\s+/).filter(Boolean);

    // $3
    params.push(searchQuery);
    const ftsQueryParamIndex = paramIndex;
    paramIndex++;
    // $4, $5, ...
    keywords.forEach((kw) => {
      params.push(kw);
      paramIndex++;
    });

    // 全文検索条件 (&@: 部分一致) - Task テーブル (エイリアス t)
    ftsCondition = `public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@ $${ftsQueryParamIndex}`;
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
          // getAuctionCount 用の条件 (getAuctionListings では JOIN で処理)
          // パラメータインデックス $1 (userId) を使用
          watchlistConditions.push(
            `EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = $${userIdParamIndex})`,
          );
          break;
        case "not_bidded":
          // getAuctionCount 用の条件
          // パラメータインデックス $1 (userId) を使用
          bidConditions.push(`NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = $${userIdParamIndex})`);
          break;
        case "bidded":
          // getAuctionCount 用の条件
          // パラメータインデックス $1 (userId) を使用
          bidConditions.push(`EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = $${userIdParamIndex})`);
          break;
        case "ended":
          statusWhereClausesSql.push(`a.status = $${paramIndex++}`);
          params.push(AuctionStatus.ENDED);
          break;
        case "not_ended":
          // 現在時刻より後に終了するオークション
          statusWhereClausesSql.push(`(a.status != $${paramIndex++} AND a."end_time" >= $${paramIndex++})`);
          params.push(AuctionStatus.ENDED, new Date());
          break;
        case "not_started":
          // 現在時刻より後に開始するオークション (PENDING 状態)
          statusWhereClausesSql.push(`(a.status = $${paramIndex++} AND a."start_time" >= $${paramIndex++})`);
          params.push(AuctionStatus.PENDING, new Date());
          break;
        case "started":
          // 現在時刻以前に開始したオークション (ACTIVE 状態)
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

    // 各条件グループを結合して whereClauses に追加
    const combinedStatusConditions = [];
    if (watchlistConditions.length > 0) {
      combinedStatusConditions.push(`(${watchlistConditions.join(joinOperator)})`);
    }
    if (bidConditions.length > 0) {
      combinedStatusConditions.push(`(${bidConditions.join(joinOperator)})`);
    }
    if (statusWhereClausesSql.length > 0) {
      combinedStatusConditions.push(`(${statusWhereClausesSql.join(joinOperator)})`);
    }

    // 最終的なステータス条件を AND で結合 (statusConditionJoinType は各グループ内の結合方法)
    if (combinedStatusConditions.length > 0) {
      whereClauses.push(`(${combinedStatusConditions.join(" AND ")})`);
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
    // end_time が (現在時刻 + minRemainingTime時間) 以降
    whereClauses.push(`a."end_time" >= $${paramIndex++}`);
    params.push(new Date(now.getTime() + minRemainingTime * 60 * 60 * 1000));
  }
  if (maxRemainingTime !== null && maxRemainingTime !== undefined && maxRemainingTime !== 0) {
    // end_time が (現在時刻 + maxRemainingTime時間) 以前
    whereClauses.push(`a."end_time" <= $${paramIndex++}`);
    params.push(new Date(now.getTime() + maxRemainingTime * 60 * 60 * 1000));
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループID (URLパラメータで指定された場合) - userGroupIdsParamIndex を使って絞り込み
   */
  if (groupIds && groupIds.length > 0 && userGroupIdsParamIndex !== null) {
    // ユーザーが所属し、かつURLパラメータで指定されたグループに絞り込む
    const allowedGroupIds = userGroupIds.filter((id) => groupIds.includes(id));
    if (allowedGroupIds.length > 0) {
      // 既存の $2 条件に加えて、さらに絞り込む
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
export const getAuctionListings = cache(async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<AuctionListingResult> => {
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
      whereClauses: baseWhereClauses, // 基本的なWHERE条件
      ftsCondition, // 全文検索条件
      params: baseParams, // 基本的なパラメータ ($1: userId, $2: userGroupIds, ...)
      paramIndex: nextParamIndex, // 次のパラメータインデックス
      keywords, // FTS用キーワード
      userIdParamIndex, // userId ($1) のインデックス
    } = await buildRawQueryComponents(listingsConditions, userId);

    // ユーザーが参加可能なグループがない場合は即座に空配列を返す
    if (baseWhereClauses.includes("1 = 0")) {
      console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_noUserGroups_参加Groupがないため、オークションを表示できません");
      return [];
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // パラメータリストのコピーを作成
    const finalParams = [...baseParams];
    let currentParamIndex = nextParamIndex; // buildRawQueryComponents が返した次のインデックスから開始

    // 2. 全文検索関連の準備 (スコア、ハイライト)
    let ftsSelectSQL = "";
    const ftsWhereSQL = ftsCondition ? `AND ${ftsCondition}` : ""; // ftsCondition は既にパラメータ ($3) を参照
    let ftsOrderBySQL = "";
    let highlightParamsSQL = ""; // ハイライト用パラメータ文字列

    if (searchQuery && keywords.length > 0) {
      // スコア計算 (パラメータ $3: searchQuery を参照)
      ftsSelectSQL += `, pgroonga_score(t.tableoid, t.ctid) as score`;
      // ハイライト (キーワードごとにパラメータを追加)
      const highlightParamIndices: string[] = [];
      keywords.forEach((kw) => {
        finalParams.push(kw); // ハイライト用キーワードをパラメータに追加
        highlightParamIndices.push(`$${currentParamIndex++}`);
      });
      highlightParamsSQL = `ARRAY[${highlightParamIndices.join(", ")}]`;
      ftsSelectSQL += `
            , pgroonga_highlight_html(t.task, ${highlightParamsSQL}) as task_highlighted
            , pgroonga_highlight_html(t.detail, ${highlightParamsSQL}) as detail_highlighted
          `;
      // FTS検索時はスコアでソートを優先する場合が多い
      ftsOrderBySQL = `score DESC`;
    }

    // 3. ソート順の決定
    let orderBySql = "";
    const defaultSort = ftsOrderBySQL ? ftsOrderBySQL : `a."created_at" DESC`; // FTSがあればスコア順、なければ作成日時順
    if (sort && sort.length > 0) {
      const primarySort = sort[0];
      const direction = primarySort.direction === "asc" ? "ASC NULLS LAST" : "DESC NULLS LAST"; // NULLS LAST を追加
      switch (primarySort.field) {
        case "relevance":
          orderBySql = ftsOrderBySQL || defaultSort; // FTS検索がない場合はデフォルトソート
          break;
        case "newest":
          orderBySql = `a."created_at" ${direction}`;
          break;
        case "time_remaining":
          orderBySql = `a."end_time" ${direction}`;
          break;
        case "bids":
          // bids_count は後でJOINするため、ここではソートできない。CTE内でソートするか、最終結果でソートする。
          // CTE内でソートする方が効率的。
          // このケースは後述の CTE 定義で対応。
          orderBySql = `"bids_count_intermediate" ${direction}`; // CTE内で計算した別名を使う
          break;
        case "price":
          orderBySql = `a."current_highest_bid" ${direction}`;
          break;
        default:
          orderBySql = defaultSort;
          break;
      }
    } else {
      orderBySql = defaultSort;
    }
    // bids でソートする場合、bids_count をCTE内で計算してソートキーに含める必要がある
    let bidsCountSelectForSort = "";
    if (orderBySql.includes('"bids_count_intermediate"')) {
      bidsCountSelectForSort = `, (SELECT COUNT(*) FROM "BidHistory" bh_sort WHERE bh_sort."auction_id" = a.id) as bids_count_intermediate`;
    }

    // 4. ページネーションパラメータの追加
    const pageNumber = page ?? 1;
    const skip = (pageNumber - 1) * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
    const take = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
    finalParams.push(take); // LIMIT
    const limitParamIndex = currentParamIndex++;
    finalParams.push(skip); // OFFSET
    const offsetParamIndex = currentParamIndex++;

    // 5. WHERE句の結合
    // baseWhereClauses には group_id, category, status(EXISTS), price, time などが含まれる
    // ftsWhereSQL には全文検索条件が含まれる
    const finalWhereClause = [...baseWhereClauses, ftsWhereSQL].filter(Boolean).join(" AND ");

    // 6. SQLクエリの組み立て (CTEを使用)
    const sql = Prisma.sql`
      WITH "FilteredAuctionsCTE" AS (
        -- ステップ1: フィルタリングとソートに必要な情報の取得
        SELECT
          a.id,
          a."task_id",
          a."created_at", -- ソート用
          a."end_time",   -- ソート用
          a."current_highest_bid" -- ソート用
          ${Prisma.raw(bidsCountSelectForSort)} -- bids ソート用の中間カウント
          ${Prisma.raw(ftsSelectSQL.includes("score") ? ", pgroonga_score(t.tableoid, t.ctid) as score" : "")} -- FTSスコア (ソート用)
        FROM "Auction" a
        JOIN "Task" t ON a."task_id" = t.id
        WHERE ${Prisma.raw(finalWhereClause)}
        -- 注意: ORDER BY はページネーションの前に適用する必要がある
        ORDER BY ${Prisma.raw(orderBySql)}
      ), "PaginatedAuctionsCTE" AS (
        -- ステップ2: ページネーションの適用
        SELECT id, task_id
        FROM "FilteredAuctionsCTE"
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      ), "BidsCountCTE" AS (
        -- ステップ3: ページ内のオークションの入札数を計算
        SELECT
          bh."auction_id",
          COUNT(bh.id)::bigint as "bids_count"
        FROM "BidHistory" bh
        WHERE bh."auction_id" IN (SELECT id FROM "PaginatedAuctionsCTE")
        GROUP BY bh."auction_id"
      ), "WatchlistCTE" AS (
        -- ステップ4: ページ内のオークションのウォッチリスト登録状況を確認 (指定ユーザー)
        SELECT
          twl."auction_id",
          TRUE as "is_watched"
        FROM "TaskWatchList" twl
        WHERE twl."auction_id" IN (SELECT id FROM "PaginatedAuctionsCTE")
          AND twl."user_id" = $${userIdParamIndex} -- $1: userId
      ), "ExecutorsCTE" AS (
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
          COALESCE(bc.bids_count, 0) as "bids_count", -- BidsCountCTE から取得 (COALESCEで0を保証)
          COALESCE(wc.is_watched, FALSE) as "is_watched", -- WatchlistCTE から取得 (COALESCEでfalseを保証)
          ex.executors_json, -- ExecutorsCTE から取得
          -- 全文検索のスコアとハイライト (FilteredAuctionsCTE または直接計算)
          ${Prisma.raw(ftsSelectSQL.includes("score") ? "fa.score as score," : "")}
          ${Prisma.raw(ftsSelectSQL.includes("task_highlighted") ? `pgroonga_highlight_html(t.task, ${highlightParamsSQL}) as task_highlighted,` : "")}
          ${Prisma.raw(ftsSelectSQL.includes("detail_highlighted") ? `pgroonga_highlight_html(t.detail, ${highlightParamsSQL}) as detail_highlighted` : "")}
          -- 末尾のカンマを削除するためのダミー列 (あるいは上記ロジックでカンマを制御)
          TRUE as _dummy -- クエリ末尾のカンマ問題を回避する簡単な方法
      FROM "PaginatedAuctionsCTE" p
      JOIN "Auction" a ON p.id = a.id
      JOIN "Task" t ON a."task_id" = t.id
      JOIN "Group" g ON a."group_id" = g.id
      LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
      LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
      LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id
      -- FilteredAuctionsCTE を JOIN してソート用の score を取得 (FTS時)
      ${Prisma.raw(ftsSelectSQL.includes("score") ? 'LEFT JOIN "FilteredAuctionsCTE" fa ON p.id = fa.id' : "")}
      -- 最終的なソート順 (ページネーション適用後の結果に対して再度ソートが必要な場合)
      -- ORDER BY ${Prisma.raw(orderBySql)} -- CTE内でソート済みのため、通常は不要
      ;
    `;

    console.log("Executing Optimized Raw SQL:", sql);
    console.log("With Params:", finalParams);

    // 7. Rawクエリ実行と型適用
    const auctionsData: RawAuctionData[] = await prisma.$queryRawUnsafe(
      // $queryRawUnsafe を使用する必要がある場合があります。
      // SQLインジェクションのリスクがないことを確認してください。
      // 特に Prisma.raw() を使用する場合。
      sql.strings.join("?"), // Prisma.sql は内部的に ? プレースホルダを使うことがあるため
      ...finalParams,
    );

    // 8. 結果の整形 (型の適用)
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
      // executors_json が string 以外の場合の処理は不要 (RawAuctionData で string | null に限定)

      // bigint を number に変換し、boolean を保証
      // この return 文で AuctionCard 型のオブジェクトを生成する
      // map が返すオブジェクト全体を AuctionCard にキャストする
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
        // taskExecutors (ExecutorJsonItem[]) を AuctionCard["executors_json"] (ExecutorJsonItem[] | string) にキャストして代入
        executors_json: taskExecutors as AuctionCard["executors_json"],
        task_highlighted: auction.task_highlighted ?? null,
        detail_highlighted: auction.detail_highlighted ?? null,
        score: auction.score ?? null,
      } as AuctionCard; // オブジェクト全体をキャスト
    });

    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_success (Optimized)", { itemsCount: items.length });
    return items;
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionListings_error (Optimized)", error);
    // エラー発生時は空配列を返すか、エラーを再スローするか検討
    // throw error; // エラーを呼び出し元に伝える場合
    return []; // 空の結果を返す場合
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション件数取得関数 (キャッシュ対応) - $queryRaw を使用するように修正
 */
export const getAuctionCount = cache(async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<number> => {
  try {
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_start (Optimized)", { ...listingsConditions });

    // 1. クエリコンポーネントの構築 (WHERE句、基本パラメータ)
    const { whereClauses, ftsCondition, params } = await buildRawQueryComponents(listingsConditions, userId);

    // ユーザーが参加可能なグループがない場合は0件
    if (whereClauses.includes("1 = 0")) {
      console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_noUserGroups");
      return 0;
    }

    // 2. WHERE句の結合
    const finalWhereClauses = [];
    if (ftsCondition) {
      finalWhereClauses.push(ftsCondition);
    }
    finalWhereClauses.push(...whereClauses); // status の EXISTS 条件なども含まれる

    // 3. SQL クエリの組み立て (COUNT)
    // Task テーブルへの JOIN は、カテゴリや全文検索の条件がある場合に必要
    const needsTaskJoin = finalWhereClauses.some((c) => c.includes("t.") || c.includes("ftsCondition"));
    const joinClause = needsTaskJoin ? 'JOIN "Task" t ON a."task_id" = t.id' : "";

    const sql = Prisma.sql`
            SELECT COUNT(*)::bigint as count
            FROM "Auction" a
            ${Prisma.raw(joinClause)}
            WHERE ${Prisma.raw(finalWhereClauses.join(" AND "))}
        `;

    console.log("Executing Optimized Raw Count SQL:", sql);
    console.log("With Count Params:", params);

    // 4. Rawクエリ実行
    const result = await prisma.$queryRaw<{ count: bigint }[]>(sql, ...params);

    // 5. 結果の整形
    const count = result?.[0]?.count ?? BigInt(0);
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_success (Optimized)", { count: Number(count) });
    return Number(count);
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionCount_error (Optimized)", error);
    return 0; // エラー時は0件
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション検索提案取得関数 (キャッシュ対応)
 * (変更なし - 元のクエリが前方一致検索で pgroonga を効率的に使っているため)
 * @param query 検索クエリ
 * @param limit 取得件数
 * @returns オークション検索提案
 */
export const getSearchSuggestions = cache(async (query: string, userId: string, limit = 10): Promise<Suggestion[]> => {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const userGroupMemberships = await prisma.groupMembership.findMany({ where: { userId }, select: { groupId: true } });
  const userGroupIds = userGroupMemberships.map((gm) => gm.groupId);
  if (userGroupIds.length === 0) return [];

  try {
    // pgroonga の前方一致 (&^) を使用
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
          public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &^ ${query} -- task と detail を結合して検索
        AND
          a."group_id" = ANY(${userGroupIds}::text[]) -- ユーザーが所属するグループのオークションのみ
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
