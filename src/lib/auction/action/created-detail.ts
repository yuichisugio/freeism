"use server";

import { prisma } from "@/lib/prisma";

import { getCachedWinnerRating } from "./cache/cache-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札者の評価を取得
 * @param winnerId 落札者のID
 * @returns 落札者の評価
 */
export async function getWinnerRating(winnerId: string) {
  const winnerRating = await getCachedWinnerRating(winnerId);
  return winnerRating;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getAuctionHistoryCreatedDetail(auctionId: string, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品したオークションの詳細を取得
   */
  const auction = await prisma.auction.findUnique({
    where: {
      id: auctionId,
      task: {
        creatorId: userId,
      },
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

  /**
   * 出品商品の詳細を返却
   */
  return auction;
}
