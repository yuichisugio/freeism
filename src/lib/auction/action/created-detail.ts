"use server";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

import { getCachedUserRating } from "./cache/cache-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札者の評価を取得
 * @param userId 落札者のID
 * @returns 落札者の評価
 */
export async function getUserRating(userId: string) {
  const userRating = await getCachedUserRating(userId);
  return userRating;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getAuctionHistoryCreatedDetail(auctionId: string, userId: string): Promise<AuctionHistoryCreatedDetail | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品or実行or報告したオークションの詳細を取得
   */
  const auction = await prisma.auction.findUnique({
    where: {
      id: auctionId,
      OR: [
        { task: { creatorId: userId } },
        { task: { executors: { some: { userId: userId } } } },
        { task: { reporters: { some: { userId: userId } } } },
      ],
    },
    select: {
      id: true,
      status: true,
      currentHighestBid: true,
      startTime: true,
      endTime: true,
      task: {
        select: {
          id: true,
          task: true,
          detail: true,
          imageUrl: true,
          status: true,
          deliveryMethod: true,
          creatorId: true,
        },
      },
      winner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      winnerId: true,
      reviews: {
        where: {
          OR: [{ reviewerId: userId }, { revieweeId: userId }],
        },
        select: {
          id: true,
          reviewerId: true,
          revieweeId: true,
          rating: true,
          comment: true,
          reviewPosition: true,
        },
      },
      bidHistories: {
        orderBy: {
          amount: "desc",
        },
        take: 10,
        select: {
          id: true,
          amount: true,
          isAutoBid: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  console.log("src/lib/auction/action/created-detail.ts_auction", auction);

  /**
   * 出品商品の詳細を返却
   */
  return auction as AuctionHistoryCreatedDetail | null;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者が提供方法を更新するアクション
 * @param taskId タスクID
 * @param deliveryMethod 提供方法
 */
export async function updateDeliveryMethod(taskId: string, deliveryMethod: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分のIDを取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法が入力されていない場合は、何もしない
   */
  if (!deliveryMethod.trim()) {
    return;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が作成したタスクかチェック
   */
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [{ creatorId: userId }, { executors: { some: { userId: userId } } }, { reporters: { some: { userId: userId } } }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が作成したタスクかチェック
   */
  if (!task) {
    console.log("[updateDeliveryMethod] task", task);
    throw new Error("このタスクを編集する権限がありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新
   */
  const updatedTask = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      deliveryMethod,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新
   */
  return updatedTask;
}
