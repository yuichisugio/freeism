"use server";

import type { ReviewPosition } from "@prisma/client";

import { getCachedAuctionReview } from "./cache/cache-auction-review-rating";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの評価を取得する
 * @param auctionId オークションID
 * @param displayUserId 表示するユーザーID
 * @returns オークションの評価
 */
export async function getAuctionReview(auctionId: string, displayUserId: string, reviewPosition: ReviewPosition) {
  const review = await getCachedAuctionReview(auctionId, displayUserId, reviewPosition);
  return review;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
