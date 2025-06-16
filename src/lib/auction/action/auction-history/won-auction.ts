"use server";

import { prisma } from "@/lib/prisma";
import { type WonAuctionItem } from "@/types/auction-types";
import { ReviewPosition, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札履歴と件数を同時に取得
 */
export async function getUserWonAuctionsWithCount(
  page = 1,
  userId: string,
  itemPerPage: number,
  wonStatus?: string,
): Promise<{ data: WonAuctionItem[]; count: number }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId || !itemPerPage || !page) {
    throw new Error("userId, itemPerPage, and page are required");
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
    statusIn = [TaskStatus.PENDING, TaskStatus.AUCTION_ACTIVE, TaskStatus.AUCTION_ENDED, TaskStatus.POINTS_DEPOSITED, TaskStatus.SUPPLIER_DONE];
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データと件数を同時取得
   */
  const [wonAuctionsData, count] = await Promise.all([
    prisma.auction.findMany({
      where: {
        winnerId: userId,
        task: { status: { in: statusIn } },
      },
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
    }),
    prisma.auction.count({
      where: {
        winnerId: userId,
        task: { status: { in: statusIn } },
      },
    }),
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
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
    rating: auction.reviews.length > 0 ? auction.reviews.reduce((acc, review) => acc + review.rating, 0) / auction.reviews.length : null,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return { data: returnWonAuctions, count };
}
