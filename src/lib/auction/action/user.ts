"use server";

import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * ユーザーIDを取得
 * @returns 現在のユーザーID
 */
export async function getCurrentUserId() {
  // next-authの最新バージョンに合わせて修正
  const session = await auth();
  return session?.user?.id;
}

/**
 * ユーザーの参加グループを取得
 * @returns ユーザーの参加グループ
 */
export const getUserGroups = cache(async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  return prisma.groupMembership.findMany({
    where: { userId },
    include: { group: true },
  });
});

/**
 * ユーザーのポイント総額を取得
 * @returns ユーザーのポイント総額
 */
export const getUserTotalPoints = cache(async () => {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const points = await prisma.groupPoint.findMany({
    where: { userId },
    select: { balance: true },
  });

  return points.reduce((total, point) => total + point.balance, 0);
});

/**
 * 出品者の評価スコアを取得
 * @param userId ユーザーID
 * @returns 評価スコア
 */
export async function getSellerRating(userId: string): Promise<number> {
  const reviews = await prisma.auctionReview.findMany({
    where: {
      revieweeId: userId,
      isSellerReview: false, // 買い手から売り手への評価のみ
    },
  });

  if (reviews.length === 0) {
    return 0;
  }

  // 平均評価スコアを計算して返す
  const totalScore = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((totalScore / reviews.length) * 10) / 10; // 小数点第一位まで
}
