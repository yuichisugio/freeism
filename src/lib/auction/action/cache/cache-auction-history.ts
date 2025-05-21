"use cache";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札者の他のレビューを取得
 * 落札者が出品側/落札側の両方ともの評価を取得して平均を計算
 * 直近100件の評価を取得
 */
export async function getCachedUserRating(userId: string): Promise<{ rating: number; reviewCount: number }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const returnReviews = await prisma.auctionReview.findMany({
    where: {
      revieweeId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      rating: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の平均評価を計算
   */
  const rating = returnReviews.length > 0 ? returnReviews.reduce((sum, review) => sum + review.rating, 0) / returnReviews.length : 0;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価数を取得
   */
  const reviewCount = returnReviews.length;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の平均評価を返却
   */
  return { rating, reviewCount };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getCachedAuctionHistoryCreatedDetail(auctionId: string): Promise<AuctionHistoryCreatedDetail | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品or実行or報告したオークションの詳細を取得
   */
  const auction = await prisma.auction.findUnique({
    where: {
      id: auctionId,
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
      bidHistories: {
        orderBy: {
          amount: "desc",
        },
        take: 100,
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
  console.log("src/lib/auction/action/cache/cache-auction-history.ts_getCachedAuctionHistoryCreatedDetail_auction", auction);

  /**
   * 出品商品の詳細を返却
   */
  return auction as AuctionHistoryCreatedDetail | null;
}
