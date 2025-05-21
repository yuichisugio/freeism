"use cache";

import type { ReviewPosition } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの評価を取得する
 */
export async function getCachedAuctionReview(
  auctionId: string,
  displayUserId: string,
  reviewPosition: ReviewPosition,
): Promise<{ rating: number; reviewCount: number } | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションの評価を取得
   */
  const review = await prisma.auctionReview.findMany({
    where: {
      auctionId,
      revieweeId: displayUserId,
      reviewPosition,
    },
    select: {
      rating: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データが存在しない場合
   */
  if (review.length === 0) {
    return {
      rating: 0,
      reviewCount: 0,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const formattedReview = {
    rating: review.reduce((acc, curr) => acc + curr.rating, 0) / review.length,
    reviewCount: review.length,
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションの評価を返す
   */
  return formattedReview;
}
