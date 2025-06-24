"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/library-setting/prisma";
import { type WonAuctionItem } from "@/types/auction-types";
import { ReviewPosition, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札履歴のWhere条件を設定
 * @param userId ユーザーID
 * @param wonStatus ステータスフィルター
 * @returns Where条件
 */
export async function getUserWonAuctionsWhereCondition(
  userId: string,
  wonStatus?: string,
): Promise<Prisma.AuctionWhereInput> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (!userId) {
    throw new Error("userId is required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * wonStatusに応じたstatus配列
   */
  let statusIn: TaskStatus[] = [
    TaskStatus.AUCTION_ENDED,
    TaskStatus.SUPPLIER_DONE,
    TaskStatus.POINTS_DEPOSITED,
    TaskStatus.TASK_COMPLETED,
    TaskStatus.FIXED_EVALUATED,
    TaskStatus.POINTS_AWARDED,
  ];
  if (wonStatus === "completed") {
    statusIn = [TaskStatus.TASK_COMPLETED, TaskStatus.FIXED_EVALUATED, TaskStatus.POINTS_AWARDED];
  } else if (wonStatus === "incomplete") {
    statusIn = [
      TaskStatus.PENDING,
      TaskStatus.AUCTION_ACTIVE,
      TaskStatus.AUCTION_ENDED,
      TaskStatus.POINTS_DEPOSITED,
      TaskStatus.SUPPLIER_DONE,
    ];
  } else if (wonStatus === "all") {
    statusIn = [
      TaskStatus.PENDING,
      TaskStatus.AUCTION_ACTIVE,
      TaskStatus.AUCTION_ENDED,
      TaskStatus.POINTS_DEPOSITED,
      TaskStatus.SUPPLIER_DONE,
      TaskStatus.TASK_COMPLETED,
      TaskStatus.FIXED_EVALUATED,
      TaskStatus.POINTS_AWARDED,
    ];
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Where条件を返却
   */
  return {
    winnerId: userId,
    task: { status: { in: statusIn } },
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札履歴を取得
 * @param page ページ番号
 * @param userId ユーザーID
 * @param itemPerPage 1ページあたりのアイテム数
 * @param wonStatus ステータスフィルター
 * @returns 落札履歴
 */
export async function getUserWonAuctions(
  page = 1,
  userId: string,
  itemPerPage: number,
  wonStatus?: string,
): Promise<WonAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId || !itemPerPage || !page) {
    throw new Error("userId, itemPerPage, and page are required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Where条件を取得
   */
  const whereCondition = await getUserWonAuctionsWhereCondition(userId, wonStatus);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを取得
   */
  const wonAuctionsData = await prisma.auction.findMany({
    where: whereCondition,
    orderBy: { endTime: "desc" },
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    select: {
      id: true,
      endTime: true,
      currentHighestBid: true,
      createdAt: true,
      task: {
        select: {
          id: true,
          task: true,
          status: true,
          deliveryMethod: true,
        },
      },
      reviews: {
        where: {
          revieweeId: userId,
          reviewPosition: ReviewPosition.BUYER_TO_SELLER,
        },
        select: { rating: true },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は空配列を返却
   */
  if (wonAuctionsData.length === 0) {
    return [];
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形して返却
   */
  const returnWonAuctions: WonAuctionItem[] = wonAuctionsData.map((auction) => ({
    auctionId: auction.id,
    currentHighestBid: auction.currentHighestBid,
    auctionEndTime: auction.endTime,
    auctionCreatedAt: auction.createdAt,
    taskId: auction.task.id,
    taskName: auction.task.task,
    taskStatus: auction.task.status,
    deliveryMethod: auction.task.deliveryMethod,
    rating:
      auction.reviews.length > 0
        ? auction.reviews.reduce((acc, review) => acc + review.rating, 0) / auction.reviews.length
        : null,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnWonAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札したオークションの件数を取得
 * getUserWonAuctions内で↓の処理は入れない。ページを跨ぐごとに全体の件数を取得しなくないため
 * @param userId ユーザーID
 * @param wonStatus ステータスフィルター
 * @returns 落札したオークションの件数
 */
export async function getUserWonAuctionsCount(userId: string, wonStatus?: string): Promise<number> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId) {
    throw new Error("userId is required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Where条件を取得
   */
  const whereCondition = await getUserWonAuctionsWhereCondition(userId, wonStatus);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データの件数を取得
   */
  const count = await prisma.auction.count({
    where: whereCondition,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は0を返却
   */
  if (count === 0) {
    return 0;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return count;
}
