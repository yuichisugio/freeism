"use server";

import { prisma } from "@/lib/prisma";
import { type BidHistoryItem } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの入札履歴と件数を同時に取得
 */
export async function getUserBidHistoriesWithCount(
  page = 1,
  userId: string,
  itemPerPage: number,
): Promise<{ data: BidHistoryItem[]; count: number }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId || !itemPerPage || !page) {
    throw new Error("userId, itemPerPage, and page are required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データと件数を同時取得
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は空配列を返却
   */
  if (allBids.length === 0 || count === 0) {
    return { data: [], count: 0 };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return { data: returnBidedAuctionPerPage, count };
}
