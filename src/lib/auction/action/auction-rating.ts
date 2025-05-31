"use server";

import type { ReviewPosition } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションレビューを追加するアクション
 * @param auctionId オークションID
 * @param revieweeId レビュー対象者ID
 * @param rating 評価
 * @param comment コメント
 * @param reviewPosition レビューポジション (SELLER_TO_BUYER または BUYER_TO_SELLER)
 */
export async function createAuctionReview(
  auctionId: string,
  revieweeId: string,
  rating: number,
  comment: string | null,
  reviewPosition: ReviewPosition,
) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 必須フィールドのバリデーション
   */
  if (!auctionId || auctionId.trim() === "") {
    throw new Error("オークションIDは必須です");
  }

  if (!revieweeId || revieweeId.trim() === "") {
    throw new Error("レビュー対象者IDは必須です");
  }

  if (!reviewPosition) {
    throw new Error("レビューポジションは必須です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 評価が0から5の間であることを確認する
   */
  if (rating < 0 || rating > 5) {
    throw new Error("評価は0から5の間で指定してください");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * userIdを取得する
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * レビューを作成する
   */
  const review = await prisma.auctionReview.create({
    data: {
      auctionId,
      reviewerId: userId,
      revieweeId,
      rating,
      comment,
      reviewPosition,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュを更新する
   */
  revalidateTag(`DisplayUserInfo:${auctionId}:${reviewPosition}`);

  return review;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
