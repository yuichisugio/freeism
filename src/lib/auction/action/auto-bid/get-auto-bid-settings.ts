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
     * 1. オークションIDと現在の最高入札額のバリデーション
     */
    if (!auctionId || !currentHighestBid) {
      throw new Error("オークションIDまたは現在の最高入札額が無効です");
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
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 5. 自動入札設定を返す
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
     * 6. エラー時の処理
     */
  } catch (error) {
    console.error("自動入札設定取得エラー:", error);
    return {
      success: false,
      message: `${error instanceof Error ? error.message : "不明なエラーが発生しました"}`,
      autoBid: null,
    };
  }
}
