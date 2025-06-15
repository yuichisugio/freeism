"use server";

import { validateAuction } from "@/lib/auction/action/bid-validation";
import { prisma } from "@/lib/prisma";

import type { ExecuteAutoBidReturn } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札設定を取得する
 * @param auctionId オークションID
 * @returns 処理結果
 */
export async function getAutoBidByUserId(auctionId: string, currentHighestBid: number): Promise<ExecuteAutoBidReturn> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. オークションの検証（最小限のチェック）
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
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message ?? "検証エラー",
        autoBid: null,
      };
    }

    // この時点でuserIdは必ず存在する
    const userId = validation.userId;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. ユーザーの自動入札設定を取得
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

    if (!autoBid) {
      return {
        success: true,
        message: "",
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 3. 自動入札設定を返す
     */
    return {
      success: true,
      message: "自動入札設定を取得しました",
      autoBid: {
        id: autoBid.id,
        maxBidAmount: autoBid.maxBidAmount,
        bidIncrement: autoBid.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 4. エラー時の処理
     */
  } catch (error) {
    console.error("自動入札設定取得エラー:", error);
    return {
      success: false,
      message: "自動入札設定の取得中にエラーが発生しました",
      autoBid: null,
    };
  }
}
