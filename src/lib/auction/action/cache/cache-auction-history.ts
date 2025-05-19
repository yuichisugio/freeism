"use cache";

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
