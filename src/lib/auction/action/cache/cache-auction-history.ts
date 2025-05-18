"use cache";

import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 落札者の他のレビューを取得
 * 落札者が出品側/落札側の両方ともの評価を取得して平均を計算
 * 直近100件の評価を取得
 */
export async function getCachedWinnerRating(winnerId: string): Promise<{ winnerRating: number; winnerReviewCount: number }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価を取得
   */
  const winnerReviews = await prisma.auctionReview.findMany({
    where: {
      revieweeId: winnerId,
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
  const winnerRating = winnerReviews.length > 0 ? winnerReviews.reduce((sum, review) => sum + review.rating, 0) / winnerReviews.length : 0;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の評価数を取得
   */
  const winnerReviewCount = winnerReviews.length;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者の平均評価を返却
   */
  return { winnerRating, winnerReviewCount };
}
