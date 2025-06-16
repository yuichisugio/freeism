"use server";

import { prisma } from "@/lib/prisma";
import { type BidHistoryItem, type FilterCondition } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの各オークションに対する最新の入札情報のみを取得
 * @param page ページ番号
 * @returns 重複のないオークションごとの最新入札履歴の配列、次のページ番号、総件数
 */
export async function getUserBidHistories(page = 1, userId: string, itemPerPage: number, _condition?: FilterCondition): Promise<BidHistoryItem[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーの全入札履歴を取得
   */
  const allBids = await prisma.bidHistory.findMany({
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    where: { userId: userId },
    distinct: ["auctionId"],
    orderBy: { createdAt: "desc" },
    select: {
      auctionId: true,
      status: true,
      auction: {
        select: {
          currentHighestBid: true,
          createdAt: true,
          endTime: true,
          task: {
            select: {
              id: true,
              task: true,
              status: true,
            },
          },
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const returnBidedAuctionPerPage: BidHistoryItem[] = allBids.map((bid) => ({
    auctionId: bid.auctionId,
    bidStatus: bid.status,
    lastBidAt: bid.auction.createdAt,
    taskId: bid.auction.task.id,
    taskName: bid.auction.task.task,
    taskStatus: bid.auction.task.status,
    currentHighestBid: bid.auction.currentHighestBid,
    auctionEndTime: bid.auction.endTime,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return returnBidedAuctionPerPage;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札履歴の件数を取得
 * @param userId ユーザーID
 * @returns 入札履歴の件数
 */
export async function getUserBidHistoryCount(userId: string): Promise<number> {
  const distinctBids = await prisma.bidHistory.findMany({
    where: {
      userId: userId,
    },
    distinct: ["auctionId"],
    select: {
      auctionId: true,
    },
  });
  return distinctBids.length;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの入札履歴と件数を同時に取得
 */
export async function getUserBidHistoriesWithCount(
  page = 1,
  userId: string,
  itemPerPage: number,
): Promise<{ data: BidHistoryItem[]; count: number }> {
  // データと件数を同時取得
  const [allBids, count] = await Promise.all([
    prisma.bidHistory.findMany({
      skip: (page - 1) * itemPerPage,
      take: itemPerPage,
      where: { userId: userId },
      distinct: ["auctionId"],
      orderBy: { createdAt: "desc" },
      select: {
        auctionId: true,
        status: true,
        auction: {
          select: {
            currentHighestBid: true,
            createdAt: true,
            endTime: true,
            task: {
              select: {
                id: true,
                task: true,
                status: true,
              },
            },
          },
        },
      },
    }),
    prisma.bidHistory
      .findMany({
        where: { userId: userId },
        distinct: ["auctionId"],
        select: { auctionId: true },
      })
      .then((distinctBids) => distinctBids.length),
  ]);

  const returnBidedAuctionPerPage: BidHistoryItem[] = allBids.map((bid) => ({
    auctionId: bid.auctionId,
    bidStatus: bid.status,
    lastBidAt: bid.auction.createdAt,
    taskId: bid.auction.task.id,
    taskName: bid.auction.task.task,
    taskStatus: bid.auction.task.status,
    currentHighestBid: bid.auction.currentHighestBid,
    auctionEndTime: bid.auction.endTime,
  }));

  return { data: returnBidedAuctionPerPage, count };
}
