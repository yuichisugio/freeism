"use server";

import { validateAuction } from "@/lib/auction/action/bid-validation";
import { prisma } from "@/lib/prisma";

import type { AutoBidResponse, ExecuteAutoBidParams } from "./auto-bid";
import { executeAutoBid } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札を設定する
 * @param auctionId オークションID
 * @param maxBidAmount 自動入札の上限入札額
 * @param bidIncrement 自動入札の入札単位
 * @returns 処理結果
 */
export async function setAutoBid(auctionId: string, maxBidAmount: number, bidIncrement: number): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. オークションの検証
     */
    const validation = await validateAuction(auctionId, {
      checkSelfListing: true,
      checkEndTime: true,
      requireActive: true,
      checkCurrentBid: null,
      currentBid: null,
      executeBid: null,
    });

    // バリデーションに失敗した場合はエラーを返す
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message || "検証エラー",
        autoBid: null,
      };
    }

    // バリデーションに成功した場合は、ユーザーIDとオークション情報を取得
    const userId = validation.userId;
    const auction = validation.auction;

    // オークション情報が取得できなかった場合はエラーを返す
    if (!auction) {
      console.log("bid-common_setAutoBid_error_!auction", !auction);
      return {
        success: false,
        message: "オークション情報が取得できませんでした",
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. 自動入札の上限入札額が現在の最高入札額より高いか確認
     */
    if (maxBidAmount <= auction.currentHighestBid) {
      console.log("bid-common_setAutoBid_error_limitBidAmount <= auction.currentHighestBid", maxBidAmount, auction.currentHighestBid);
      return {
        success: false,
        message: "最大入札額は現在の最高入札額より高く設定してください",
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 3. 入札単位が正の整数か確認
     */
    if (bidIncrement < 1) {
      console.log("bid-common_setAutoBid_error_bidIncrement < 1", bidIncrement);
      return {
        success: false,
        message: "入札単位は1以上の整数で設定してください",
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 4. トランザクションで自動入札の設定を保存
     */
    const result = await prisma.$transaction(async (tx) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 自分自身の既存の自動入札設定を確認
      const existingAutoBid = await tx.autoBid.findFirst({
        where: {
          auctionId,
          userId,
        },
      });

      console.log("bid-common_setAutoBid_existingAutoBid", existingAutoBid);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      let autoBid;

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      // 自分自身の既存の自動入札設定が存在する場合
      if (existingAutoBid) {
        console.log("bid-common_setAutoBid_existingAutoBid_if_update");
        // 既存の設定を更新
        autoBid = await tx.autoBid.update({
          where: { id: existingAutoBid.id },
          data: {
            maxBidAmount,
            bidIncrement,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        console.log("bid-common_setAutoBid_existingAutoBid_else_create");
        // 新規設定を作成
        autoBid = await tx.autoBid.create({
          data: {
            auctionId,
            userId,
            maxBidAmount,
            bidIncrement,
            isActive: true,
          },
        });
      }

      console.log("bid-common_setAutoBid_autoBid", autoBid);

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      return autoBid;
    });

    // 新しい自動入札設定後に即時の自動入札処理を実行
    try {
      // 自動入札設定後、現在の最高入札者が自分でない場合は自動入札処理を実行
      if (auction.currentHighestBidderId !== validation.userId) {
        const params: ExecuteAutoBidParams = {
          auctionId,
          currentHighestBid: auction.currentHighestBid,
          currentHighestBidderId: auction.currentHighestBidderId,
          validationDone: true,
          paramsValidationResult: validation,
        };
        await executeAutoBid(params);
      }
    } catch (autoBidError) {
      console.error("自動入札設定後の自動入札処理でエラーが発生:", autoBidError);
      // 自動入札処理でエラーが発生しても設定自体は成功しているので、設定成功を返す
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return {
      success: true,
      message: "自動入札を設定しました",
      autoBid: {
        id: result.id,
        maxBidAmount: result.maxBidAmount,
        bidIncrement: result.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札設定エラー:", error);
    console.log("setAutoBid_error_stack", new Error().stack);
    return {
      success: false,
      message: "自動入札の設定中にエラーが発生しました",
      autoBid: null,
    };
  }
}
