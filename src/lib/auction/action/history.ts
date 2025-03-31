"use server";

import { auth } from "@/auth";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/lib/auction/type/types";
import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの入札履歴を取得
 * @returns 入札履歴の配列
 */
export async function getUserBidHistory(): Promise<BidHistoryItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 認証
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  // 入札履歴を取得
  const bidHistory = await prisma.bidHistory.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      auction: {
        include: {
          task: {
            select: {
              id: true,
              task: true,
              detail: true,
              imageUrl: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return bidHistory;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの各オークションに対する最新の入札情報のみを取得
 * @returns 重複のないオークションごとの最新入札履歴の配列
 */
export async function getUserLatestBids(): Promise<BidHistoryItem[]> {
  console.log("getUserLatestBids_start");

  // 認証
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  // ユーザーの全入札履歴を取得
  const allBids = await prisma.bidHistory.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      auction: {
        include: {
          task: {
            select: {
              id: true,
              task: true,
              detail: true,
              imageUrl: true,
              status: true,
            },
          },
        },
      },
    },
  });

  // オークションIDごとに最新の入札のみをフィルタリング
  const latestBidsByAuctionId = new Map<string, BidHistoryItem>();

  // オークションIDごとに最新の入札のみをフィルタリング
  for (const bid of allBids) {
    if (!latestBidsByAuctionId.has(bid.auctionId)) {
      latestBidsByAuctionId.set(bid.auctionId, bid);
    }
  }

  // Mapの値を配列に変換して返却
  return Array.from(latestBidsByAuctionId.values());
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札したオークション履歴を取得
 * @returns 落札したオークション履歴の配列
 */
export async function getUserWonAuctions(): Promise<WonAuctionItem[]> {
  console.log("getUserWonAuctions_start");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  const wonAuctions = await prisma.auction.findMany({
    where: {
      winnerId: session.user.id,
      status: AuctionStatus.ENDED,
    },
    orderBy: {
      endTime: "desc",
    },
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
        },
      },
      reviews: {
        where: {
          reviewerId: session.user.id,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          isSellerReview: true,
        },
      },
    },
  });

  return wonAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの出品したオークション履歴を取得
 * @returns 出品したオークション履歴の配列
 */
export async function getUserCreatedAuctions(): Promise<CreatedAuctionItem[]> {
  console.log("getUserCreatedAuctions_start");
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  const createdAuctions = await prisma.auction.findMany({
    where: {
      task: {
        creatorId: session.user.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      task: {
        select: {
          id: true,
          task: true,
          detail: true,
          imageUrl: true,
          status: true,
          deliveryMethod: true,
        },
      },
      winner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      reviews: {
        where: {
          reviewerId: session.user.id,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          isSellerReview: true,
        },
      },
    },
  });

  return createdAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューを追加するアクション
 * @param auctionId オークションID
 * @param revieweeId レビュー対象者ID
 * @param rating 評価
 * @param comment コメント
 * @param isSellerReview セラーレビューかどうか
 */
export async function createAuctionReview(auctionId: string, revieweeId: string, rating: number, comment: string | null, isSellerReview: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  const review = await prisma.auctionReview.create({
    data: {
      auctionId,
      reviewerId: session.user.id,
      revieweeId,
      rating,
      comment,
      isSellerReview,
    },
  });

  return review;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者が提供方法を更新するアクション
 * @param taskId タスクID
 * @param deliveryMethod 提供方法
 */
export async function updateDeliveryMethod(taskId: string, deliveryMethod: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  // 自分が作成したタスクかチェック
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      creatorId: session.user.id,
    },
  });

  if (!task) {
    throw new Error("このタスクを編集する権限がありません");
  }

  const updatedTask = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      deliveryMethod,
    },
  });

  return updatedTask;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    include: {
      auction: true,
    },
  });

  if (!task) {
    throw new Error("タスクが見つかりません");
  }

  // 自分が作成者か落札者か確認
  const isCreator = task.creatorId === session.user.id;
  const isWinner = task.auction?.winnerId === session.user.id;

  if (!isCreator && !isWinner) {
    throw new Error("このタスクを完了する権限がありません");
  }

  // タスク完了ステータスに更新
  const updatedTask = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: "TASK_COMPLETED",
    },
  });

  return updatedTask;
}
