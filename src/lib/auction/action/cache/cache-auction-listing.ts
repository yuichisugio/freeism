"use cache";

import type { AuctionCard, AuctionListingResult, AuctionListingsConditions } from "@/types/auction-types";
import { cache } from "react";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { Prisma, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数の引数の型
 */
export type GetAuctionListingsParams = {
  listingsConditions: AuctionListingsConditions;
  userId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数の引数の型
 */
type ExecutorJsonItem = {
  id: string | null;
  rating: number | null;
  userId: string | null;
  userImage: string | null;
  userSettingsUsername: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数の引数の型
 */
type ExecutorJsonItemFromDB = {
  id: string | null;
  user_id: string | null;
  user_image: string | null;
  username: string | null;
  rating: number | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Raw クエリの戻り値の型を定義
 */
type RawAuctionData = {
  id: string;
  current_highest_bid: number;
  end_time: Date;
  start_time: Date;
  status: TaskStatus; // TaskStatusに変更
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
 * オークション一覧と件数を同時に取得する関数
 * "use cache"では、シリアライズできる情報のみキャッシュできるため、Prisma.sql``を返す関数はキャッシュできないので、一つにまとめている
 */
export const cachedGetAuctionListingsAndCount = cache(
  async ({ listingsConditions, userId }: GetAuctionListingsParams): Promise<{ listings: AuctionListingResult; count: number }> => {
    try {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 引数がnullの場合はエラーを投げる
       */
      if (!listingsConditions || !userId) throw new Error("listingsConditions or userId is required");

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 引数を分解
       */
      const { categories, status, minBid, maxBid, minRemainingTime, maxRemainingTime, groupIds, statusConditionJoinType, searchQuery } =
        listingsConditions;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * パラメータとWHERE句を初期化
       */
      const whereClauses: Prisma.Sql[] = [];
      let ftsCondition: Prisma.Sql = Prisma.empty;
      const keywords: string[] = [];
      let userGroupIds: string[] = [];

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * ユーザーが参加しているグループIDを取得
       */
      const userGroupMemberships = await prisma.groupMembership.findMany({
        where: { userId },
        select: { groupId: true },
      });
      userGroupIds = userGroupMemberships.map((gm) => gm.groupId);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * ユーザーが参加しているグループがない場合は、空の結果を返す
       */
      if (userGroupIds.length === 0) {
        return { listings: [], count: 0 };
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 基本的なWHERE条件
       */
      whereClauses.push(Prisma.sql`a."group_id" = ANY(${userGroupIds}::text[])`);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * searchQuery がある場合
       * 全文検索条件
       * keywords 配列に格納
       * pgroonga_query_extract_keywords で使用
       * searchQuery をスペースで分割してキーワードとして扱う
       */
      if (searchQuery) {
        const normalizedQuery = searchQuery.trim().replace(/\s+/g, " OR ");
        ftsCondition = Prisma.sql`public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ ${normalizedQuery}`;
        keywords.push(...searchQuery.trim().split(/\s+/).filter(Boolean));
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * ステータス (buildRawQueryComponents より)
       */
      if (status && status.length > 0) {
        const statusWhereClausesSql: Prisma.Sql[] = [];
        const watchlistConditions: Prisma.Sql[] = [];
        const bidConditions: Prisma.Sql[] = [];
        const now = new Date();

        status.forEach((statusItem) => {
          switch (statusItem) {
            case "watchlist":
              watchlistConditions.push(
                Prisma.sql`EXISTS (SELECT 1 FROM "TaskWatchList" twl WHERE twl."auction_id" = a.id AND twl."user_id" = ${userId})`,
              );
              break;
            case "not_bidded":
              bidConditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ${userId})`);
              break;
            case "bidded":
              bidConditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "BidHistory" bh WHERE bh."auction_id" = a.id AND bh."user_id" = ${userId})`);
              break;
            case "ended":
              statusWhereClausesSql.push(Prisma.sql`t.status::text = ${TaskStatus.AUCTION_ENDED}`);
              statusWhereClausesSql.push(Prisma.sql`t.status::text = ${TaskStatus.SUPPLIER_DONE}`);
              statusWhereClausesSql.push(Prisma.sql`t.status::text = ${TaskStatus.TASK_COMPLETED}`);
              statusWhereClausesSql.push(Prisma.sql`t.status::text = ${TaskStatus.FIXED_EVALUATED}`);
              statusWhereClausesSql.push(Prisma.sql`t.status::text = ${TaskStatus.POINTS_AWARDED}`);
              statusWhereClausesSql.push(Prisma.sql`t.status::text = ${TaskStatus.POINTS_DEPOSITED}`);
              break;
            case "not_ended":
              // 終了していないオークション = 開始前または実行中のオークション
              statusWhereClausesSql.push(Prisma.sql`(t.status::text = ${TaskStatus.PENDING} OR t.status::text = ${TaskStatus.AUCTION_ACTIVE})`);
              break;
            case "not_started":
              statusWhereClausesSql.push(Prisma.sql`(t.status::text = ${TaskStatus.PENDING} AND a."start_time" >= ${now})`);
              break;
            case "started":
              statusWhereClausesSql.push(Prisma.sql`(t.status::text = ${TaskStatus.AUCTION_ACTIVE} AND a."start_time" <= ${now})`);
              break;
          }
        });

        const joinOperatorString = statusConditionJoinType === "AND" ? " AND " : " OR ";
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
        if (combinedStatusConditions.length > 0) {
          whereClauses.push(Prisma.sql`(${Prisma.join(combinedStatusConditions, " AND ")})`);
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 入札額
       */
      if (minBid !== null && minBid !== undefined) {
        whereClauses.push(Prisma.sql`a."current_highest_bid" >= ${minBid}`);
      }
      if (maxBid !== null && maxBid !== undefined && maxBid !== 0) {
        whereClauses.push(Prisma.sql`a."current_highest_bid" <= ${maxBid}`);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 残り時間
       * 1時間(= 60 * 60 * 1000)単位
       */
      const nowForRemainingTime = new Date();
      if (minRemainingTime !== null && minRemainingTime !== undefined) {
        const minEndTime = new Date(nowForRemainingTime.getTime() + minRemainingTime * 60 * 60 * 1000);
        whereClauses.push(Prisma.sql`a."end_time" >= ${minEndTime}`);
      }
      if (maxRemainingTime !== null && maxRemainingTime !== undefined && maxRemainingTime !== 0) {
        const maxEndTime = new Date(nowForRemainingTime.getTime() + maxRemainingTime * 60 * 60 * 1000);
        whereClauses.push(Prisma.sql`a."end_time" <= ${maxEndTime}`);
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * グループID (URLパラメータで指定された場合)
       * フィルターで選択したグループIDのGroupに参加しているか確認して、参加している場合はwhereに追加
       * else内で、ユーザーは指定されたグループに参加していないので、そのグループのオークションを見る権限がないので、表示するオークションは0件にしている
       */
      if (groupIds && groupIds.length > 0) {
        const allowedGroupIds = userGroupIds.filter((id) => groupIds.includes(id));
        if (allowedGroupIds.length > 0) {
          whereClauses.push(Prisma.sql`a."group_id" = ANY(${allowedGroupIds}::text[])`);
        } else {
          return { listings: [], count: 0 };
        }
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション一覧取得ロジック
       * searchQuery は上で展開済みのため、ここでは使用しない
       */
      const { sort, page } = listingsConditions;

      let ftsSelectSQL: Prisma.Sql = Prisma.empty;
      let ftsOrderBySQL: Prisma.Sql = Prisma.empty;
      let highlightParamsSQL: Prisma.Sql = Prisma.empty;
      let ftsHighlightTaskSQL: Prisma.Sql = Prisma.empty;
      let ftsHighlightDetailSQL: Prisma.Sql = Prisma.empty;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 全文検索
       */
      // searchQueryとkeywordsがある場合
      if (searchQuery && keywords.length > 0) {
        // スコアを取得するために、pgroonga_scoreを使用する
        ftsSelectSQL = Prisma.sql`, pgroonga_score(t.tableoid, t.ctid) as score`;
        // ハイライトするために、pgroonga_query_extract_keywordsを使用する
        highlightParamsSQL = Prisma.sql`pgroonga_query_extract_keywords(${keywords.join(" OR ")})`;
        // ハイライトするために、pgroonga_highlight_htmlを使用する
        ftsHighlightTaskSQL = Prisma.sql`, pgroonga_highlight_html(t.task, ${highlightParamsSQL}) as task_highlighted`;
        // ハイライトするために、pgroonga_highlight_htmlを使用する
        ftsHighlightDetailSQL = Prisma.sql`, pgroonga_highlight_html(t.detail, ${highlightParamsSQL}) as detail_highlighted`;
        // スコアでソートする
        ftsOrderBySQL = Prisma.sql`score DESC`;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * ソート
       */
      let orderBySql: Prisma.Sql = Prisma.empty;
      // 全文検索がない場合は、作成日時の降順にソート。全文検索がある場合は、スコアでソートする
      const defaultSort = ftsOrderBySQL !== Prisma.empty ? ftsOrderBySQL : Prisma.sql`a."created_at" DESC`;

      // sortの指定がある場合
      if (sort && sort.length > 0) {
        const primarySort = sort[0];
        // asc の場合は、NULLS LAST
        const directionSql = primarySort.direction === "asc" ? Prisma.sql`ASC NULLS LAST` : Prisma.sql`DESC NULLS LAST`;
        switch (primarySort.field) {
          case "relevance":
            orderBySql = ftsOrderBySQL !== Prisma.empty ? ftsOrderBySQL : defaultSort;
            break;
          case "newest":
            orderBySql = Prisma.sql`"created_at" ${directionSql}`;
            break;
          case "time_remaining":
            orderBySql = Prisma.sql`"end_time" ${directionSql}`;
            break;
          case "bids":
            orderBySql = Prisma.sql`"bids_count_intermediate" ${directionSql}`;
            break;
          case "price":
            orderBySql = Prisma.sql`"current_highest_bid" ${directionSql}`;
            break;
          default:
            orderBySql = defaultSort;
            break;
        }
      } else {
        orderBySql = defaultSort;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 入札数でソートする場合
       */
      let bidsCountSelectForSort: Prisma.Sql = Prisma.empty;
      if (sort && sort.length > 0 && sort[0].field === "bids") {
        bidsCountSelectForSort = Prisma.sql`, (SELECT COUNT(*) FROM "BidHistory" bh_sort WHERE bh_sort."auction_id" = a.id) as bids_count_intermediate`;
      }

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * ページネーション
       */
      const pageNumber = page ?? 1;
      const skip = (pageNumber - 1) * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
      const take = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 最終的なWHERE句を作成
       */
      // 全文検索がある場合は、ftsConditionを追加
      // それ以外は、whereClausesをそのまま使う
      const finalWhere: Prisma.Sql = Prisma.join(
        [ftsCondition, ...whereClauses].filter((s) => s !== Prisma.empty),
        " AND ",
      );

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 最終的なORDER BY句
       */
      // ソートの指定がある場合は、orderBySqlを使用する
      // それ以外は、空のSQLを返却する
      const finalOrderBy = orderBySql !== Prisma.empty ? Prisma.sql`ORDER BY ${orderBySql}` : Prisma.empty;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション一覧取得SQL
       */
      const listingsSql: Prisma.Sql = Prisma.sql`
        WITH "FilteredAuctionsCTE" AS (
          SELECT
            a."id",
            a."task_id",
            a."created_at",
            a."end_time",
            a."current_highest_bid"
            ${bidsCountSelectForSort}
            ${ftsSelectSQL}
          FROM "Auction" a
          JOIN "Task" t ON a."task_id" = t.id
          ${finalWhere !== Prisma.empty ? Prisma.sql`WHERE ${finalWhere}` : Prisma.empty}
          ${finalOrderBy}
        ),
        "PaginatedAuctionsCTE" AS (
          SELECT
            "id",
            "task_id",
            "created_at",
            "end_time",
            "current_highest_bid"
            ${sort && sort.length > 0 && sort[0].field === "bids" ? Prisma.sql`, bids_count_intermediate` : Prisma.empty}
            ${ftsSelectSQL !== Prisma.empty ? Prisma.sql`, score` : Prisma.empty}
          FROM "FilteredAuctionsCTE"
          LIMIT ${take} OFFSET ${skip}
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
            AND twl."user_id" = ${userId}
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
            ${ftsSelectSQL !== Prisma.empty ? Prisma.sql`, p.score as score` : Prisma.empty}
            ${ftsHighlightTaskSQL}
            ${ftsHighlightDetailSQL}
        FROM "PaginatedAuctionsCTE" p
        JOIN "Auction" a ON p.id = a.id
        JOIN "Task" t ON a."task_id" = t.id
        JOIN "Group" g ON a."group_id" = g.id
        LEFT JOIN "BidsCountCTE" bc ON p.id = bc.auction_id
        LEFT JOIN "WatchlistCTE" wc ON p.id = wc.auction_id
        LEFT JOIN "ExecutorsCTE" ex ON a."task_id" = ex.task_id
        ${finalOrderBy}
      `;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション一覧取得
       */
      const auctionsData: RawAuctionData[] = await prisma.$queryRaw(listingsSql);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション一覧のデータを整形
       */
      // オークション一覧のデータをAuctionCard型に変換
      const items: AuctionListingResult = auctionsData.map<AuctionCard>((auction: RawAuctionData): AuctionCard => {
        // オークションの実行者のデータを取得
        let taskExecutors: ExecutorJsonItem[] = [];
        // オークションの実行者のデータがある場合は、ExecutorJsonItem型に変換
        if (auction.executors_json && typeof auction.executors_json === "string") {
          try {
            // オークションの実行者のデータをJSON.parseでパースして、unknown型に変換
            const parsedExecutorsUnknown: unknown = JSON.parse(auction.executors_json);
            // パースしたデータが配列かどうかをチェック
            if (Array.isArray(parsedExecutorsUnknown)) {
              // パースしたデータをunknown型の配列に変換
              const parsedExecutors = parsedExecutorsUnknown as unknown[];
              // パースしたデータをExecutorJsonItem型に変換
              taskExecutors = parsedExecutors
                .map((exec: unknown): ExecutorJsonItem | null => {
                  // パースしたデータがExecutorJsonItemFromDB型かどうかをチェック
                  if (isExecutorObjectFromDB(exec)) {
                    // ExecutorJsonItemFromDB型の場合は、ExecutorJsonItem型に変換
                    return {
                      id: exec.id,
                      rating: exec.rating,
                      userId: exec.user_id,
                      userImage: exec.user_image,
                      userSettingsUsername: exec.username ?? "未設定",
                    };
                  }
                  // ExecutorJsonItemFromDB型でない場合は、nullを返却
                  return null;
                })
                // nullを除外して、ExecutorJsonItem型の配列に変換
                .filter((exec): exec is ExecutorJsonItem => exec !== null);
            }
          } catch (e) {
            // パースに失敗した場合は、エラーを出力
            console.error("Failed to parse taskExecutors_json", e, auction.executors_json);
            taskExecutors = [];
          }
        }

        // AuctionCard型に変換。taskExecutorsはAuctionCard["executors_json"]型に変換
        return {
          id: auction.id,
          current_highest_bid: auction.current_highest_bid,
          end_time: auction.end_time,
          start_time: auction.start_time,
          status: auction.status,
          bids_count: Number(auction.bids_count ?? 0),
          is_watched: !!auction.is_watched,
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
        } as AuctionCard;
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション件数取得ロジック
       */
      // countの場合は、ftsConditionがある場合はftsConditionをそのまま使う
      const finalWhereForCount: Prisma.Sql[] = [];
      if (ftsCondition && ftsCondition !== Prisma.empty) {
        finalWhereForCount.push(ftsCondition);
      }
      // それ以外は、whereClausesをそのまま使う
      finalWhereForCount.push(...whereClauses.filter((c) => c !== Prisma.empty));

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション件数取得SQL
       */
      const needsTaskJoinForCount = finalWhereForCount.some((c) => c.sql.includes("t.") || c === ftsCondition);
      const finalJoinForCount = needsTaskJoinForCount ? Prisma.sql`JOIN "Task" t ON a."task_id" = t.id` : Prisma.empty;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション件数取得SQL
       */
      const countSql = Prisma.sql`
        SELECT COUNT(*)::bigint as count
        FROM "Auction" a
        ${finalJoinForCount}
        ${finalWhereForCount.length > 0 ? Prisma.sql`WHERE ${Prisma.join(finalWhereForCount, " AND ")}` : Prisma.empty}
      `;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション件数取得
       */
      const countResult = await prisma.$queryRaw<{ count: bigint }[]>(countSql);
      const count = Number(countResult?.[0]?.count ?? BigInt(0));

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークション一覧と件数を返却
       */
      return { listings: items, count };
    } catch (error) {
      console.error("src/lib/auction/action/cache-auction-listing.ts_cachedGetAuctionListingsAndCount_error", error);
      return { listings: [], count: 0 };
    }
  },
);

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数の引数の型
 * @param obj - オブジェクト
 * @returns オブジェクトがExecutorJsonItemFromDB型かどうか
 */
function isExecutorObjectFromDB(obj: unknown): obj is ExecutorJsonItemFromDB {
  // オブジェクトでない場合は、falseを返却
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  // オブジェクトの場合は、id, user_id, user_image, username, ratingがあるかどうかをチェック。ある場合はtrueを返却
  const potentialExec = obj as Record<string, unknown>;

  const result =
    // idがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "id" in potentialExec &&
    (typeof potentialExec.id === "string" || potentialExec.id === null) &&
    // user_idがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "user_id" in potentialExec &&
    (typeof potentialExec.user_id === "string" || potentialExec.user_id === null) &&
    // user_imageがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "user_image" in potentialExec &&
    (typeof potentialExec.user_image === "string" || potentialExec.user_image === null) &&
    // usernameがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "username" in potentialExec &&
    (typeof potentialExec.username === "string" || potentialExec.username === null) &&
    // ratingがあるかどうかをチェック。ある場合は、numberかnullかどうかをチェック
    "rating" in potentialExec &&
    (typeof potentialExec.rating === "number" || potentialExec.rating === null);

  // オブジェクトがExecutorJsonItemFromDB型かどうかを返却。ある場合はtrueを返却
  return result;
}
