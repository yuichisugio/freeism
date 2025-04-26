"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

import { type AuctionWithDetails } from "../type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの現在のステータスを取得
 * @param auction オークション情報
 * @returns オークションのステータス
 */
export async function getAuctionStatus(auction: AuctionWithDetails): Promise<"upcoming" | "active" | "ended"> {
  const now = new Date();

  if (now < new Date(auction.startTime)) {
    return "upcoming";
  } else if (now > new Date(auction.endTime)) {
    return "ended";
  } else {
    return "active";
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーのポイント残高を取得
 * @param userId ユーザーID
 * @param groupId グループID
 * @returns ユーザーのポイント残高
 */
export async function getUserPointBalance(userId: string, groupId: string): Promise<number> {
  const groupPoint = await prisma.groupPoint.findUnique({
    where: {
      userId_groupId: {
        userId,
        groupId,
      },
    },
  });

  return groupPoint?.balance ?? 0;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札可能か確認する
 * @param auction オークション情報
 * @param bidAmount 入札金額
 * @returns 入札可能かどうか
 */
export async function canPlaceBid(auction: AuctionWithDetails, bidAmount: number): Promise<{ canBid: boolean; message?: string }> {
  // セッションからユーザー情報を取得
  const userId = await getAuthenticatedSessionUserId();

  // オークションのステータスを確認
  const status = await getAuctionStatus(auction);

  // 開催前または終了済みの場合は入札不可
  if (status === "upcoming") {
    return { canBid: false, message: "オークションはまだ開始していません" };
  }

  if (status === "ended") {
    return { canBid: false, message: "オークションは終了しました" };
  }

  // 出品者（タスク作成者）は入札不可
  if (auction.task.creator.id === userId) {
    return { canBid: false, message: "自分のオークションには入札できません" };
  }

  // 最低入札金額を確認（現在の最高入札額+1ポイント以上）
  const minimumBid = auction.currentHighestBid + 1;
  if (bidAmount < minimumBid) {
    return {
      canBid: false,
      message: `最低入札金額（${minimumBid}ポイント）以上を入力してください`,
    };
  }

  // ユーザーのポイント残高を確認。ポイントが不足している場合でも入札可能だが、注意メッセージは表示する
  const userPointBalance = await getUserPointBalance(userId, auction.task.group.id);
  if (userPointBalance < bidAmount) {
    return {
      canBid: true,
      message: `ポイント残高が不足しています（残高: ${userPointBalance}ポイント）`,
    };
  }

  return { canBid: true };
}
