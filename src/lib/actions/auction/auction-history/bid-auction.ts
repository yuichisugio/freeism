"use server";

import { prisma } from "@/lib/prisma";
import { type BidHistoryItem } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの入札履歴と件数を同時に取得
 * @param page ページ番号
 * @param userId ユーザーID
 * @param itemPerPage 1ページあたりのアイテム数
 * @returns 入札履歴
 */
export async function getUserBidHistories(page = 1, userId: string, itemPerPage: number): Promise<BidHistoryItem[]> {
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は空配列を返却
   */
  if (allBids.length === 0) {
    return [];
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
  return returnBidedAuctionPerPage;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの入札したオークションの件数を取得
 * getUserBidHistories内で↓の処理は入れない。ページを跨ぐごとに全体の件数を取得しなくないため
 * @param userId ユーザーID
 * @returns 入札したオークションの件数
 */
export async function getUserBidHistoriesCount(userId: string): Promise<number> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータが不足している場合はエラーを返却
   */
  if (!userId) {
    throw new Error("userId is required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データの件数を取得
   * prismaのcountメソッドはdistinctが使えないため、生SQLを使用
   */
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "auctionId") as count
    FROM "bidHistory"
    WHERE "userId" = ${userId}
  `;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合はエラーを返却
   * - !result[0]?.countと記載すると、0でもエラーになるため、明示的にundefinedかnullを指定
   * 単体テストで実装が変わったことを検知するために、↓のif文を入れる
   */
  if (!Array.isArray(result) || result[0]?.count === undefined || result[0]?.count === null) {
    throw new Error("Invalid query result");
  }
  const count = Number(result[0].count);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データがない場合は空配列を返却
   */
  if (!count || count === 0) {
    return 0;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返却
   */
  return count;
}
