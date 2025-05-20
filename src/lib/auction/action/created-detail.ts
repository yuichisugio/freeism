"use server";

import { prisma } from "@/lib/prisma";

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
export async function getAuctionHistoryCreatedDetail(auctionId: string, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/lib/auction/action/created-detail.ts_auctionId", auctionId);
  console.log("src/lib/auction/action/created-detail.ts_userId", userId);

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
    include: {
      task: true,
      winner: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      reviews: {
        where: {
          OR: [{ reviewerId: userId }, { revieweeId: userId }],
        },
      },
      bidHistories: {
        orderBy: {
          amount: "desc",
        },
        take: 10,
        include: {
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
  return auction;
}
