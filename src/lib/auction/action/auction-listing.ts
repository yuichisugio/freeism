"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { AuctionStatus } from "@prisma/client";

import { AUCTION_CONSTANTS } from "../constants";
import { type AuctionListingResult, type AuctionListingsConditions } from "../type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// AuctionWhereInput型の定義
type AuctionWhereInput = {
  task?: {
    groupId?: { in: string[] } | string;
    task?: { contains: string; mode: "insensitive" };
    OR?: Array<{ task: { contains: string; mode: "insensitive" } } | { detail: { contains: string; mode: "insensitive" } }>;
  };
  watchlists?: {
    some: {
      userId: string;
    };
  };
  bidHistories?: {
    none?: {
      userId: string;
    };
    some?: {
      userId: string;
    };
  };
  status?:
    | AuctionStatus
    | {
        not: AuctionStatus;
      };
  currentHighestBid?: {
    gte?: number;
    lte?: number;
  };
  endTime?: {
    gte?: Date;
    lte?: Date;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * AuctionOrderByInput型の定義
 */
type AuctionOrderByInput = {
  createdAt?: "asc" | "desc";
  endTime?: "asc" | "desc";
  currentHighestBid?: "asc" | "desc";
  bidHistories?: { _count: "asc" | "desc" };
  _count?: { bidHistories: "asc" | "desc" };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション一覧を取得する関数
 * @param params 取得パラメータ
 * @returns オークション一覧
 */
export async function getAuctionListings({ listingsConditions }: { listingsConditions: AuctionListingsConditions }): Promise<AuctionListingResult> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const { categories, status, minBid, maxBid, minRemainingTime, maxRemainingTime, groupIds, searchQuery, sort, page } = listingsConditions;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 開始ログとパラメータ
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_start", {
      categories,
      status,
      minBid,
      maxBid,
      minRemainingTime,
      maxRemainingTime,
      groupIds,
      searchQuery,
      sort: sort?.map((s) => s.field),
      sortDirection: sort?.map((s) => s.direction),
      page,
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ユーザーIDを取得。必ず返ってくる。返ってこない場合は↓内でログイン画面にリダイレクトされる
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ユーザーが参加しているグループIDを取得
    let userGroupIds = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });

    // ユーザーが参加しているグループIDがない場合は空の配列を返す
    if (userGroupIds.length === 0) {
      console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_noUserGroups_参加Groupがないため、オークションを表示できません");
      userGroupIds = [];
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 基本的なフィルター条件
    const where: AuctionWhereInput = {
      task: {
        groupId: { in: userGroupIds.map((group) => group.groupId) },
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // カテゴリの値があり、「すべて」でない場合は、where条件を追加
    if (categories && categories.length > 0 && !categories.includes("すべて")) {
      // 複数カテゴリで検索するためのOR条件を作成
      const categoryConditions = categories
        .filter((c) => c !== null)
        .map((category) => ({
          task: { contains: category, mode: "insensitive" as const },
        }));

      // OR条件を追加
      where.task = {
        ...where.task,
        OR: [...(where.task?.OR ?? []), ...categoryConditions],
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ステータスの値があり、配列の長さが0より大きい場合は、where条件を追加
    if (status && status.length > 0) {
      for (const statusItem of status) {
        switch (statusItem) {
          case "watchlist":
            where.watchlists = {
              some: {
                userId,
              },
            };
            break;
          case "not_bidded":
            where.bidHistories = {
              none: {
                userId,
              },
            };
            break;
          case "bidded":
            where.bidHistories = {
              some: {
                userId,
              },
            };
            break;
          case "ended":
            where.status = AuctionStatus.ENDED;
            break;
          case "not_ended":
            where.status = {
              not: AuctionStatus.ENDED,
            };
            where.endTime = {
              gte: new Date(),
            };
            console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_not_ended", where);
            break;
          default:
            // "all" の場合は追加条件なし
            break;
        }
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 入札額の最低価格がある場合
    if (minBid !== null && minBid !== undefined) {
      where.currentHighestBid = {
        ...where.currentHighestBid,
        gte: minBid,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 入札額の最高価格がある場合
    if (maxBid !== null && maxBid !== undefined && maxBid !== 0) {
      where.currentHighestBid = {
        ...where.currentHighestBid,
        lte: maxBid,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 残り時間の最低値と最高値がある場合
    if (minRemainingTime !== null || maxRemainingTime !== null) {
      const now = new Date();
      let minDate: Date | undefined = undefined;
      let maxDate: Date | undefined = undefined;

      // 残り時間の最低値がある場合
      if (minRemainingTime !== null && minRemainingTime !== undefined) {
        // 安全に時間を追加するためにタイムスタンプを使用
        minDate = new Date(now.getTime() + minRemainingTime * 60 * 60 * 1000);
        where.endTime = {
          ...where.endTime,
          gte: minDate,
        };
      }

      // 残り時間の最高値がある場合
      if (maxRemainingTime !== null && maxRemainingTime !== undefined && maxRemainingTime !== 0) {
        // 安全に時間を追加するためにタイムスタンプを使用
        maxDate = new Date(now.getTime() + maxRemainingTime * 60 * 60 * 1000);
        where.endTime = {
          ...where.endTime,
          lte: maxDate,
        };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // グループIDでフィルタリング
    if (groupIds && groupIds.length > 0) {
      where.task = {
        ...where.task,
        groupId: { in: groupIds },
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 検索クエリによるフィルタリング
    if (searchQuery) {
      where.task = {
        ...where.task,
        OR: [{ task: { contains: searchQuery, mode: "insensitive" } }, { detail: { contains: searchQuery, mode: "insensitive" } }],
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ソート条件の設定
    let orderBy: AuctionOrderByInput = {};

    // デフォルトの並び順（新着順）
    orderBy = { createdAt: "desc" };

    // ソート条件がある場合
    if (sort && sort.length > 0) {
      // 最初のソート条件のみ使用（複数ソートはPrismaでは複雑なため）
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
          // 入札数で並び替え
          orderBy = { bidHistories: { _count: sortDirection } };
          break;
        case "price":
          // 最高入札額で並び替え
          orderBy = { currentHighestBid: sortDirection };
          break;
        default:
          orderBy = { createdAt: sortDirection };
          break;
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ページネーションで、スキップする件数を作成
    const pageNumber = page ?? 1;
    const skip = (pageNumber - 1) * AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_where", where);
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_orderBy", orderBy);
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_skip", skip);
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_take", AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE);

    // 一覧に表示するオークションを取得
    const auctions = await prisma.auction.findMany({
      where,
      orderBy,
      skip,
      take: AUCTION_CONSTANTS.DISPLAY.PAGE_SIZE,
      include: {
        task: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        bidHistories: {
          orderBy: {
            amount: "desc",
          },
          take: 1,
        },
        watchlists: {
          where: {
            userId,
          },
        },
        _count: {
          select: { bidHistories: true },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // クリエイターの評価を取得するためのuserIdを一括取得
    const creatorIds = auctions.map((auction) => auction.task.creator.id);

    // クリエイターの評価を取得
    const creatorReviews = await prisma.auctionReview.findMany({
      where: {
        revieweeId: { in: creatorIds },
      },
      select: {
        revieweeId: true,
        rating: true,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // クリエイターIDごとに評価を集計
    const creatorRatings = creatorIds.reduce(
      (acc, creatorId) => {
        const reviews = creatorReviews.filter((review) => review.revieweeId === creatorId);
        if (reviews.length === 0) {
          acc[creatorId] = null;
        } else {
          // 加重平均で評価を計算（小数点第2位まで）
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          acc[creatorId] = Number((totalRating / reviews.length).toFixed(2));
        }
        return acc;
      },
      {} as Record<string, number | null>,
    );

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 結果を整形
    const items = auctions.map((auction) => {
      // 現在の最高入札額に1ポイント足した額（落札可能金額）
      const bidToBeatAmount = auction.currentHighestBid + 1;

      return {
        id: auction.id,
        taskId: auction.taskId,
        title: auction.task.task,
        description: auction.task.detail,
        imageUrl: auction.task.imageUrl,
        currentBid: auction.currentHighestBid,
        bidToBeatAmount,
        endTime: auction.endTime,
        startTime: auction.startTime,
        status: auction.status,
        isWatched: auction.watchlists.length > 0,
        bidsCount: auction._count.bidHistories,
        seller: {
          id: auction.task.creator.id,
          name: auction.task.creator.name,
          image: auction.task.creator.image,
          rating: creatorRatings[auction.task.creator.id],
        },
        group: {
          id: auction.task.group.id,
          name: auction.task.group.name,
        },
      };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 成功ログ
    console.log("src/lib/auction/action/auction-listing.ts_getAuctionListings_success", { itemsCount: items.length });

    // 最終的な結果を返す
    return items;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    // エラーログ
    console.error("src/lib/auction/action/auction-listing.ts_getAuctionListings_error", error);
    throw error;
  }
}
