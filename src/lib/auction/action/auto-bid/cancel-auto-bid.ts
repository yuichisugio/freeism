"use server";

import { validateAuction } from "@/lib/auction/action/bid-validation";
import { prisma } from "@/lib/prisma";

import { type AutoBidResponse } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札を取り消す
 * @param auctionId オークションID
 * @returns 処理結果
 */
export async function cancelAutoBid(auctionId: string): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. オークションの検証
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

    // バリデーションに成功した場合は、ユーザーIDを取得
    const userId = validation.userId;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. トランザクションで自動入札の設定を無効化
     */
    const result = await prisma.$transaction(async (tx) => {
      // 既存の自動入札設定を確認
      const existingAutoBid = await tx.autoBid.findFirst({
        where: {
          auctionId,
          userId,
          isActive: true,
        },
      });

      if (!existingAutoBid) {
        return null;
      }

      // 設定を無効化
      return await tx.autoBid.update({
        where: { id: existingAutoBid.id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
    });

    if (!result) {
      return {
        success: false,
        message: "有効な自動入札設定が見つかりません",
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: "自動入札を取り消しました",
      autoBid: {
        id: result.id,
        maxBidAmount: result.maxBidAmount,
        bidIncrement: result.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札取り消しエラー:", error);
    return {
      success: false,
      message: "自動入札の取り消し中にエラーが発生しました",
      autoBid: null,
    };
  }
}
