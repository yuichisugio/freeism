"use server";

import { validateAuction } from "@/lib/auction/action/bid-validation";
import { prisma } from "@/lib/prisma";

import { type ExecuteAutoBidReturn } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札を取り消す
 * @param auctionId オークションID
 * @param isDisplayAutoBidding 自動入札中フラグ
 * @returns 処理結果
 */
export async function cancelAutoBid(auctionId: string, isDisplayAutoBidding: boolean): Promise<ExecuteAutoBidReturn> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. オークションIDのバリデーション
     */
    if (!auctionId) {
      throw new Error("オークションIDが無効です");
    }

    /**
     * 2. 自動入札中フラグのバリデーション
     * 自動入札中フラグがfalseの場合は、自動入札を取り消すことができないので、エラーを投げる
     * クライアント側でもバリデーションするが、テストやサーバー側でもバリデーションの忘れを検知するために、サーバー側でもバリデーションする
     */
    if (!isDisplayAutoBidding) {
      throw new Error("自動入札中フラグが無効です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 3. オークションの検証
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
     * 4. 自動入札の設定を無効化
     */
    const result = await prisma.autoBid.update({
      where: { userId_auctionId: { userId, auctionId } },
      data: { isActive: false },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 5. 自動入札の設定を無効化
     * 自動入札の設定を無効化した結果を返す
     */
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
      message: `${error instanceof Error ? error.message : "不明なエラーが発生しました"}`,
      autoBid: null,
    };
  }
}
