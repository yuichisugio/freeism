"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { AuctionStatus } from "@prisma/client";

import { AUCTION_CONSTANTS } from "../constants";
import { type AuctionListingResult, type AuctionListingsConditions } from "../type/types";

// findMany の include オプションに対応する型を定義
type AuctionWithDetails = Prisma.AuctionGetPayload<{
  include: {
    task: {
      include: {
        creator: { select: { id: true; name: true; image: true } };
        group: { select: { id: true; name: true } };
      };
    };
    bidHistories: { orderBy: { amount: "desc" }; take: 1 };
    watchlists: { where: { userId: string } }; // userId は string に修正
    _count: { select: { bidHistories: true } };
  };
}>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// AuctionWhereInput型の定義は削除し、Prisma.AuctionWhereInput を直接使用する

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * AuctionOrderByInput型の定義
 */
// type AuctionOrderByInput = { // Prisma.AuctionOrderByWithRelationInput を使用するためコメントアウト or 削除
//   createdAt?: "asc" | "desc";
//   endTime?: "asc" | "desc";
//   currentHighestBid?: "asc" | "desc";
//   bidHistories?: { _count: "asc" | "desc" };
//   _count?: { bidHistories: "asc" | "desc" };
// };
// Prisma.AuctionOrderByWithRelationInput を使用する方が堅牢
type AuctionOrderByInput = Prisma.AuctionOrderByWithRelationInput;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの Prisma where 句を構築するヘルパー関数
 * @param listingsConditions 検索条件
 * @returns Prisma の where 句と userId
 */
async function buildAuctionWhereClause(listingsConditions: AuctionListingsConditions): Promise<{ where: Prisma.AuctionWhereInput; userId: string }> {
  const { categories, status, minBid, maxBid, minRemainingTime, maxRemainingTime, groupIds, searchQuery, statusConditionJoinType } =
    listingsConditions;

  // ユーザーIDを取得。必ず返ってくる。返ってこない場合は↓内でログイン画面にリダイレクトされる
  const userId = await getAuthenticatedSessionUserId();

  // ユーザーが参加しているグループIDを取得
  let userGroupIds = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });

  // ユーザーが参加しているグループIDがない場合は、以降の処理で空の結果になるように調整
  if (userGroupIds.length === 0) {
    console.log("src/lib/auction/action/auction-listing.ts_buildAuctionWhereClause_noUserGroups_参加Groupがないため、オークションを表示できません");
    userGroupIds = []; // 空の配列を設定することで、 groupId: { in: [] } となり、結果が空になる
  }

  // 基本的なフィルター条件
  const where: Prisma.AuctionWhereInput = {
    task: {
      groupId: { in: userGroupIds.map((group) => group.groupId) },
    },
  };

  // AND 条件を格納する配列
  const filterConditions: Prisma.AuctionWhereInput[] = [];

  // カテゴリのフィルタリング (Taskのcategoryフィールドを想定)
  if (categories && categories.length > 0 && !categories.includes("すべて")) {
    const validCategories = categories.filter((c): c is string => c !== null && c !== "すべて");
    if (validCategories.length > 0) {
      // カテゴリ名の部分一致検索を行うためにOR条件を使用
      filterConditions.push({
        OR: validCategories.map((category) => ({
          task: {
            category: { contains: category, mode: "insensitive" },
          },
        })),
      });
    }
  }

  // ステータスのフィルタリング
  if (status && status.length > 0) {
    // statusに関するwhere条件を一時的に保持
    const statusWhereClauses: Prisma.AuctionWhereInput[] = [];

    for (const statusItem of status) {
      switch (statusItem) {
        case "watchlist":
          // watchlists は Auction モデルのリレーションなので、トップレベルで指定
          filterConditions.push({ watchlists: { some: { userId } } });
          break;
        case "not_bidded":
          // bidHistories も同様にトップレベルで指定
          filterConditions.push({ bidHistories: { none: { userId } } });
          break;
        case "bidded":
          filterConditions.push({ bidHistories: { some: { userId } } });
          break;
        case "ended":
          statusWhereClauses.push({ status: AuctionStatus.ENDED });
          break;
        case "not_ended":
          // status と endTime を組み合わせる
          statusWhereClauses.push({
            status: { not: AuctionStatus.ENDED },
            endTime: { gte: new Date() }, // 現在時刻より後のもの
          });
          break;
        case "not_started":
          statusWhereClauses.push({
            status: AuctionStatus.PENDING,
            startTime: { gte: new Date() }, // 現在時刻より後のもの
          });
          break;
        case "started":
          statusWhereClauses.push({
            status: AuctionStatus.ACTIVE,
            startTime: { lte: new Date() }, // 現在時刻より前のもの
          });
          break;
        default: // "all" またはその他の場合は何もしない
          break;
      }
    }
    // 複数のステータス条件がある場合は OR または AND で結合
    if (statusWhereClauses.length > 0) {
      if (statusConditionJoinType === "AND") {
        // AND条件で結合
        filterConditions.push({ AND: statusWhereClauses });
      } else {
        // デフォルトはOR条件で結合
        filterConditions.push({ OR: statusWhereClauses });
      }
    }
  }

  // 入札額のフィルタリング
  const bidFilters: Prisma.IntFilter = {};
  if (minBid !== null && minBid !== undefined) {
    bidFilters.gte = minBid;
  }
  if (maxBid !== null && maxBid !== undefined && maxBid !== 0) {
    bidFilters.lte = maxBid;
  }
  if (Object.keys(bidFilters).length > 0) {
    filterConditions.push({ currentHighestBid: bidFilters });
  }

  // 残り時間のフィルタリング
  const timeFilters: Prisma.DateTimeFilter = {};
  const now = new Date();
  if (minRemainingTime !== null && minRemainingTime !== undefined) {
    timeFilters.gte = new Date(now.getTime() + minRemainingTime * 60 * 60 * 1000);
  }
  if (maxRemainingTime !== null && maxRemainingTime !== undefined && maxRemainingTime !== 0) {
    timeFilters.lte = new Date(now.getTime() + maxRemainingTime * 60 * 60 * 1000);
  }
  if (Object.keys(timeFilters).length > 0) {
    filterConditions.push({ endTime: timeFilters });
  }

  // グループIDのフィルタリング (基本条件で既に設定されているため、必要に応じて上書きまたは絞り込み)
  if (groupIds && groupIds.length > 0) {
    // ユーザーが所属するグループと指定されたグループの両方に合致するもののみを対象とする
    const allowedGroupIds = userGroupIds.map((ug) => ug.groupId).filter((id) => groupIds.includes(id));
    // where.task.groupId.in を上書きする
    if (where.task) {
      if (typeof where.task === "object") {
        if (where.task.groupId && typeof where.task.groupId === "object" && "in" in where.task.groupId) {
          // 型安全に更新するために型アサーションを使用
          const groupIdFilter = where.task.groupId as Prisma.StringFilter;
          groupIdFilter.in = allowedGroupIds;
        } else {
          // 型安全に新しいtaskオブジェクトを作成
          const taskFilter: Prisma.TaskWhereInput = {
            ...(where.task as Prisma.TaskWhereInput),
            groupId: { in: allowedGroupIds },
          };
          where.task = taskFilter;
        }
      }
    } else {
      // task自体がない場合は新規作成
      where.task = { groupId: { in: allowedGroupIds } };
    }
  }

  // 検索クエリのフィルタリング (Taskのtaskまたはdetailフィールド)
  if (searchQuery) {
    filterConditions.push({
      OR: [{ task: { task: { contains: searchQuery, mode: "insensitive" } } }, { task: { detail: { contains: searchQuery, mode: "insensitive" } } }],
    });
  }

  // 組み立てたフィルター条件を AND で結合
  if (filterConditions.length > 0) {
    if (where.AND) {
      // 既にAND条件がある場合は配列に追加
      if (Array.isArray(where.AND)) {
        where.AND.push(...filterConditions);
      } else {
        // 単一オブジェクトの場合は配列にする
        where.AND = [where.AND, ...filterConditions];
      }
    } else {
      // AND条件がなければ新規作成
      where.AND = filterConditions;
    }
  }

  console.log("src/lib/auction/action/auction-listing.ts_buildAuctionWhereClause_where", where);

  return { where, userId };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数
 * @param params 取得パラメータ
 * @returns オークション一覧
 */
export async function getAuctionListings({ listingsConditions }: { listingsConditions: AuctionListingsConditions }): Promise<AuctionListingResult> {
  try {
    const { sort, page } = listingsConditions;

    // 開始ログ
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_start", { ...listingsConditions });

    // where句とuserIdを構築
    const { where, userId } = await buildAuctionWhereClause(listingsConditions);

    // ユーザーが参加しているグループがない場合、空の結果を返す
    if (
      where.task?.groupId &&
      typeof where.task.groupId === "object" &&
      "in" in where.task.groupId &&
      Array.isArray(where.task.groupId.in) &&
      where.task.groupId.in.length === 0
    ) {
      console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_noUserGroups_参加Groupがないため、オークションを表示できません");
      return [];
    }

    // ソート条件の設定
    let orderBy: AuctionOrderByInput = { createdAt: "desc" }; // デフォルトは新着順
    if (sort && sort.length > 0) {
      const primarySort = sort[0];
      const sortDirection = primarySort.direction ?? "desc";
      switch (primarySort.field) {
        case "newest":
          orderBy = { createdAt: sortDirection };
          break;
        case "time_remaining":
          orderBy = { endTime: sortDirection };
          break;
        case "bids":
          orderBy = { bidHistories: { _count: sortDirection } };
          break;
        case "price":
          orderBy = { currentHighestBid: sortDirection };
          break;
        default:
          orderBy = { createdAt: sortDirection };
          break;
      }
    }

    // ページネーション
    const pageNumber = page ?? 1;
    const skip = (pageNumber - 1) * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;
    const take = AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;

    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_prismaParams", { where, orderBy, skip, take });
    console.dir(where, { depth: null });

    // オークションデータを取得
    const auctions: AuctionWithDetails[] = await prisma.auction.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        task: { include: { creator: { select: { id: true, name: true, image: true } }, group: { select: { id: true, name: true } } } },
        bidHistories: { orderBy: { amount: "desc" }, take: 1 }, // 最高入札履歴のみ取得
        watchlists: { where: { userId } }, // ログインユーザーのウォッチリスト情報
        _count: { select: { bidHistories: true } }, // 入札数カウント
      },
    });

    // クリエイターの評価を一括取得・計算
    const creatorIds = auctions.map((auction) => auction.task.creator.id);
    let creatorRatings: Record<string, number | null> = {}; // 初期化

    if (creatorIds.length > 0) {
      const creatorReviews = await prisma.auctionReview.findMany({
        where: { revieweeId: { in: creatorIds } },
        select: { revieweeId: true, rating: true },
      });

      creatorRatings = creatorIds.reduce(
        (acc, creatorId) => {
          const reviews = creatorReviews.filter((review) => review.revieweeId === creatorId);
          acc[creatorId] = reviews.length > 0 ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(2)) : null;
          return acc;
        },
        {} as Record<string, number | null>,
      );
    }

    // 結果を整形
    const items = auctions.map((auction) => ({
      id: auction.id,
      taskId: auction.taskId,
      title: auction.task.task,
      description: auction.task.detail,
      imageUrl: auction.task.imageUrl,
      currentBid: auction.currentHighestBid,
      bidToBeatAmount: auction.currentHighestBid + 1,
      endTime: auction.endTime,
      startTime: auction.startTime,
      status: auction.status,
      isWatched: auction.watchlists.length > 0,
      bidsCount: auction._count.bidHistories,
      seller: {
        id: auction.task.creator.id,
        name: auction.task.creator.name,
        image: auction.task.creator.image,
        rating: creatorRatings[auction.task.creator.id] ?? null, // 評価が存在しない場合はnull
      },
      group: {
        id: auction.task.group.id,
        name: auction.task.group.name,
      },
    }));

    // 成功ログ
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_success", { itemsCount: items.length });
    return items;
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionListings_error", error);
    throw error; // エラーを再スロー
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 指定された条件に一致するオークションの総数を取得する関数
 * @param params 取得パラメータ
 * @returns オークションの総数
 */
export async function getAuctionCount({ listingsConditions }: { listingsConditions: AuctionListingsConditions }): Promise<number> {
  try {
    // 開始ログ
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_start", { ...listingsConditions });

    // where句を構築 (userId はここでは不要)
    const { where } = await buildAuctionWhereClause(listingsConditions);

    // ユーザーが参加しているグループがない場合、件数は0
    if (
      where.task?.groupId &&
      typeof where.task.groupId === "object" &&
      "in" in where.task.groupId &&
      Array.isArray(where.task.groupId.in) &&
      where.task.groupId.in.length === 0
    ) {
      console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_noUserGroups_参加Groupがないため、オークションはありません");
      return 0;
    }

    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_where", where);

    // 件数を取得
    const totalCount = await prisma.auction.count({ where });

    // 成功ログ
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionCount_success", { totalCount });
    return totalCount;
  } catch (error) {
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionCount_error", error);
    throw error; // エラーを再スロー
  }
}
