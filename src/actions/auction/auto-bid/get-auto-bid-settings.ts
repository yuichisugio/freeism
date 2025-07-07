"use server";

import { validateAuction } from "@/actions/auction/bid-validation";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

import type { ExecuteAutoBidReturn } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札設定を取得する
 * @param auctionId オークションID
 * @param currentHighestBid 現在の最高入札額
 * @returns 処理結果
 */
export async function getAutoBidByUserId(
  auctionId: string,
  currentHighestBid: number,
): PromiseResult<ExecuteAutoBidReturn | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 1. オークションIDと現在の最高入札額のバリデーション
   */
  if (!auctionId || currentHighestBid < 0) {
    throw new Error("オークションIDが無効、または現在の最高入札額が負の値です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 2. オークションの検証（最小限のチェック）
   */
  const validation = await validateAuction(auctionId, {
    checkSelfListing: null,
    checkEndTime: null,
    checkCurrentBid: null,
    currentBid: null,
    requireActive: null,
    executeBid: null,
  });

  // バリデーションエラーチェック
  if (!validation.success || !validation.data.userId) {
    return {
      success: false,
      message: validation.message ?? "検証エラー",
      data: null,
    };
  }

  // この時点でuserIdは必ず存在する
  const userId = validation.data.userId;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 3. ユーザーの自動入札設定を取得
   */
  const autoBid = await prisma.autoBid.findFirst({
    where: {
      auctionId,
      userId,
      isActive: true,
      maxBidAmount: {
        gt: currentHighestBid,
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 4. 自動入札設定が存在しない場合
   */
  if (!autoBid) {
    return {
      success: true,
      message: "自動入札設定が見つかりませんでした",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 5. 自動入札設定を返す
   */
  return {
    success: true,
    message: "自動入札設定を取得しました",
    data: {
      id: autoBid.id,
      maxBidAmount: autoBid.maxBidAmount,
      bidIncrement: autoBid.bidIncrement,
    },
  };
}
