"use server";

import type { ReviewPosition } from "@prisma/client";

import { getCachedDisplayUserInfo } from "./cache/cache-auction-rating";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの評価・ユーザー情報を取得する
 * @param auctionId オークションID
 * @param reviewPosition レビューの向き
 * @returns DisplayUserInfo[]
 */
export async function getDisplayUserInfo(auctionId: string, reviewPosition: ReviewPosition) {
  return await getCachedDisplayUserInfo(auctionId, reviewPosition);
}
