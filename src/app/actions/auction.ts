"use server";

import type { BidFormData } from "@/lib/auction/types";
import { cache } from "react";
import { auth } from "@/auth";
import { sendEventToAuctionSubscribers, serverIsAuctionWatched, serverPlaceBid, serverToggleWatchlist } from "@/lib/auction/auction-service";
import { AUCTION_CATEGORIES, DISPLAY } from "@/lib/auction/constants";
import { AuctionEventType } from "@/lib/auction/types";
import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@prisma/client";

// フィルタリングパラメータの型定義
export type AuctionFilterParams = {
  category?: string;
  status?: "all" | "watchlist" | "not_bidded" | "bidded" | "ended";
  minPrice?: number;
  maxPrice?: number;
  remainingTime?: "1h" | "1d" | "1w" | "1m" | "all";
  groupId?: string;
  searchQuery?: string;
};

// ソートオプションの型定義
export type AuctionSortOption = "newest" | "time_remaining" | "price_asc" | "price_desc" | "bids";

// 出品商品一覧取得のパラメータ型
export type GetAuctionListingsParams = {
  page?: number;
  pageSize?: number;
  filters?: AuctionFilterParams;
  sort?: AuctionSortOption;
};

// 定数を取得する関数（"use server"ファイルからエクスポートするため）
export async function getAuctionCategories() {
  return AUCTION_CATEGORIES;
}

export async function getAuctionPageSize() {
  return DISPLAY.PAGE_SIZE;
}

// ユーザーIDを取得
export async function getCurrentUserId() {
  // next-authの最新バージョンに合わせて修正
  const session = await auth();
  return session?.user?.id;
}

// ユーザーの参加グループを取得
export const getUserGroups = cache(async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  return prisma.groupMembership.findMany({
    where: { userId },
    include: { group: true },
  });
});

// ユーザーのポイント総額を取得
export const getUserTotalPoints = cache(async () => {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const points = await prisma.groupPoint.findMany({
    where: { userId },
    select: { balance: true },
  });

  return points.reduce((total, point) => total + point.balance, 0);
});

// オークション一覧を取得する関数
export async function getAuctionListings({ page = 1, pageSize = DISPLAY.PAGE_SIZE, filters = {}, sort = "newest" }: GetAuctionListingsParams) {
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

// ウォッチリストの状態を更新
export async function toggleWatchlist(auctionId: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("ログインが必要です");
  }

  // 現在のウォッチリスト状態を確認
  const existingWatchlist = await prisma.taskWatchList.findUnique({
    where: {
      userId_auctionId: {
        userId,
        auctionId,
      },
    },
  });

  // 存在する場合は削除、存在しない場合は作成
  if (existingWatchlist) {
    await prisma.taskWatchList.delete({
      where: {
        id: existingWatchlist.id,
      },
    });
    return { isWatched: false };
  } else {
    await prisma.taskWatchList.create({
      data: {
        userId,
        auctionId,
      },
    });
    return { isWatched: true };
  }
}

/**
 * 入札を行うサーバーアクション
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @returns 入札結果（成功/失敗、メッセージ、入札履歴）
 */
export async function placeBidAction(auctionId: string, bidData: BidFormData) {
  // 認証セッションを取得
  const session = await auth();
  if (!session || !session.user) {
    return {
      success: false,
      message: "ログインが必要です",
    };
  }

  const userId = session.user.id;
  if (!userId) {
    return {
      success: false,
      message: "ユーザーIDが取得できません",
    };
  }

  try {
    // bidDataにuser_idを追加
    const updatedBidData = {
      ...bidData,
      user_id: userId,
    };

    // サーバー側の入札処理を実行
    const result = await serverPlaceBid(auctionId, updatedBidData, userId);

    // 入札成功時の通知は既存の実装に任せる
    await sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, result);

    return result;
  } catch (error) {
    console.error("入札サーバーアクションエラー:", error);
    return {
      success: false,
      message: "サーバーでエラーが発生しました",
    };
  }
}

/**
 * ウォッチリストの切り替えを行うサーバーアクション
 * @param auctionId オークションID
 * @returns 操作結果（成功/失敗、メッセージ、ウォッチリスト状態）
 */
export async function toggleWatchlistAction(auctionId: string) {
  // 認証セッションを取得
  const session = await auth();
  if (!session || !session.user) {
    return {
      success: false,
      message: "ログインが必要です",
      isWatched: null,
    };
  }

  const userId = session.user.id;
  if (!userId) {
    return {
      success: false,
      message: "ユーザーIDが取得できません",
      isWatched: null,
    };
  }

  try {
    // ウォッチリストの切り替え処理を実行
    const isWatched = await serverToggleWatchlist(auctionId, userId);

    return {
      success: true,
      isWatched,
      message: isWatched ? "ウォッチリストに追加しました" : "ウォッチリストから削除しました",
    };
  } catch (error) {
    console.error("ウォッチリスト切り替えエラー:", error);
    return {
      success: false,
      message: "ウォッチリストの更新中にエラーが発生しました",
      isWatched: null,
    };
  }
}

/**
 * ウォッチリストの状態を取得するサーバーアクション
 * @param auctionId オークションID
 * @returns ウォッチリストの状態
 */
export async function getWatchlistStatusAction(auctionId: string) {
  // 認証セッションを取得
  const session = await auth();
  if (!session || !session.user) {
    return {
      success: false,
      isWatched: false,
    };
  }

  const userId = session.user.id;
  if (!userId) {
    return {
      success: false,
      isWatched: false,
    };
  }

  try {
    // ウォッチリストの状態を確認
    const isWatched = await serverIsAuctionWatched(auctionId, userId);

    return {
      success: true,
      isWatched,
    };
  } catch (error) {
    console.error("ウォッチリスト状態取得エラー:", error);
    return {
      success: false,
      isWatched: false,
    };
  }
}
