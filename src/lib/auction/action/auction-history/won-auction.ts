"use server";

import { prisma } from "@/lib/prisma";
import { type WonAuctionItem } from "@/types/auction-types";
import { ReviewPosition, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの落札したオークション履歴を取得
 * @param page ページ番号
 * @returns 落札したオークション履歴の配列、次のページ番号、総件数
 */
export async function getUserWonAuctions(page = 1, userId: string, itemPerPage: number, wonStatus?: string): Promise<WonAuctionItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  /**
   * 落札したオークション履歴を取得
   */
  const wonAuctionsData = await prisma.auction.findMany({
    where: {
      winnerId: userId,
      task: {
        status: {
          in: statusIn,
        },
      },
    },
    orderBy: {
      endTime: "desc",
    },
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
        select: {
          rating: true,
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
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
    rating: auction.reviews.length > 0 ? auction.reviews.reduce((acc, review) => acc + review.rating, 0) / auction.reviews.length : null, // レビューの平均値
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnWonAuctions;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札履歴の件数を取得
 * @param userId ユーザーID
 * @returns 落札履歴の件数
 */
export async function getUserWonAuctionsCount(userId: string, wonStatus?: string): Promise<number> {
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
  const count = await prisma.auction.count({
    where: {
      winnerId: userId,
      task: {
        status: {
          in: statusIn,
        },
      },
    },
  });
  return count;
}

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
  // wonStatusに応じたstatus配列
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

  // データと件数を同時取得
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

  return { data: returnWonAuctions, count };
}
