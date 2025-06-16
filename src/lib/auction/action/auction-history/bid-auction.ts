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
