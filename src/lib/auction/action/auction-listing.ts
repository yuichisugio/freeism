"use server";

import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@prisma/client";

import { type AuctionListingResult, type GetAuctionListingsParams } from "../types";
import { AUCTION_CATEGORIES, DISPLAY } from "./constants";
import { getCurrentUserId, getUserGroups, getUserTotalPoints } from "./user";

/**
 * 定数を取得する関数（"use server"ファイルからエクスポートするため）
 */
export async function getAuctionCategories() {
  return AUCTION_CATEGORIES;
}

/**
 * 表示設定を取得する関数
 */
export async function getAuctionPageSize() {
  return DISPLAY.PAGE_SIZE;
}

/**
 * オークション一覧を取得する関数
 * @param params 取得パラメータ
 */
export async function getAuctionListings({ page = 1, pageSize = DISPLAY.PAGE_SIZE, filters = {}, sort = "newest" }: GetAuctionListingsParams): Promise<AuctionListingResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      items: [],
      totalCount: 0,
      currentPage: page,
      totalPages: 0,
      userTotalPoints: 0,
    };
  }

  // ユーザーが参加しているグループIDを取得
  const userGroups = await getUserGroups();
  const userGroupIds = userGroups.map((membership) => membership.groupId);

  if (userGroupIds.length === 0) {
    return {
      items: [],
      totalCount: 0,
      currentPage: page,
      totalPages: 0,
      userTotalPoints: 0,
    };
  }

  // 基本的なフィルター条件
  let where: any = {
    task: {
      groupId: { in: userGroupIds },
    },
  };

  // カテゴリでフィルタリング
  if (filters.category && filters.category !== "すべて") {
    where.task = {
      ...where.task,
      task: { contains: filters.category, mode: "insensitive" }, // カテゴリ名で簡易フィルタリング
    };
  }

  // ステータスでフィルタリング
  if (filters.status) {
    switch (filters.status) {
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
      default:
        // "all" の場合は追加条件なし
        break;
    }
  }

  // 価格範囲でフィルタリング
  if (filters.minPrice !== undefined) {
    where.currentHighestBid = {
      ...where.currentHighestBid,
      gte: filters.minPrice,
    };
  }
  if (filters.maxPrice !== undefined) {
    where.currentHighestBid = {
      ...where.currentHighestBid,
      lte: filters.maxPrice,
    };
  }

  // 残り時間でフィルタリング
  if (filters.remainingTime && filters.remainingTime !== "all") {
    const now = new Date();
    let endDate = new Date();

    switch (filters.remainingTime) {
      case "1h":
        endDate.setHours(now.getHours() + 1);
        break;
      case "1d":
        endDate.setDate(now.getDate() + 1);
        break;
      case "1w":
        endDate.setDate(now.getDate() + 7);
        break;
      case "1m":
        endDate.setMonth(now.getMonth() + 1);
        break;
    }

    where.endTime = {
      gte: now,
      lte: endDate,
    };
  }

  // グループIDでフィルタリング
  if (filters.groupId) {
    where.task = {
      ...where.task,
      groupId: filters.groupId,
    };
  }

  // 検索クエリによるフィルタリング
  if (filters.searchQuery) {
    where.task = {
      ...where.task,
      OR: [{ task: { contains: filters.searchQuery, mode: "insensitive" } }, { detail: { contains: filters.searchQuery, mode: "insensitive" } }],
    };
  }

  // ソート条件の設定
  let orderBy: any = {};
  switch (sort) {
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    case "time_remaining":
      orderBy = { endTime: "asc" };
      break;
    case "price_asc":
      orderBy = { currentHighestBid: "asc" };
      break;
    case "price_desc":
      orderBy = { currentHighestBid: "desc" };
      break;
    case "bids":
      orderBy = { bidHistories: { _count: "desc" } };
      break;
    default:
      orderBy = { createdAt: "desc" };
      break;
  }

  // 総数を取得
  const totalCount = await prisma.auction.count({ where });
  const totalPages = Math.ceil(totalCount / pageSize);

  // ページネーション
  const skip = (page - 1) * pageSize;

  // メインクエリ実行
  const auctions = await prisma.auction.findMany({
    where,
    orderBy,
    skip,
    take: pageSize,
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

  // ユーザーの総ポイントを取得
  const userTotalPoints = await getUserTotalPoints();

  // クリエイターの評価を取得するための一括取得
  const creatorIds = auctions.map((auction) => auction.task.creator.id);
  const creatorReviews = await prisma.auctionReview.findMany({
    where: {
      revieweeId: { in: creatorIds },
    },
    select: {
      revieweeId: true,
      rating: true,
    },
  });

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

  return {
    items,
    totalCount,
    currentPage: page,
    totalPages,
    userTotalPoints,
  };
}
