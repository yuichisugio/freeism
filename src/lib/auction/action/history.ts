"use server";

import { auth } from "@/auth";
import { type BidHistoryItem, type CreatedAuctionItem, type WonAuctionItem } from "@/lib/auction/type/types";
import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@prisma/client";

// ユーザーの入札履歴を取得
export async function getUserBidHistory(): Promise<BidHistoryItem[]> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("認証が必要です");
  }

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

// ユーザーの落札したオークション履歴を取得
export async function getUserWonAuctions(): Promise<WonAuctionItem[]> {
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

// ユーザーの出品したオークション履歴を取得
export async function getUserCreatedAuctions(): Promise<CreatedAuctionItem[]> {
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

// オークションレビューを追加するアクション
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

// 出品者が提供方法を更新するアクション
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

// タスク完了処理アクション
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
