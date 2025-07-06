"use server";

import { validateAuction } from "@/actions/auction/bid-validation";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

import type { ExecuteAutoBidParams, ExecuteAutoBidReturn } from "./auto-bid";
import { executeAutoBid } from "./auto-bid";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札を設定する
 * @param auctionId オークションID
 * @param maxBidAmount 自動入札の上限入札額
 * @param bidIncrement 自動入札の入札単位
 * @returns 処理結果
 */
export async function setAutoBid(
  auctionId: string,
  maxBidAmount: number,
  bidIncrement: number,
): PromiseResult<ExecuteAutoBidReturn | null> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. 入札単位・上限入札額が正の整数か確認
     */
    if (bidIncrement < 1 || maxBidAmount < 1) {
      throw new Error("入札単位・上限入札額は1以上の整数で設定してください");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. オークションIDが有効か確認
     */
    if (!auctionId) {
      throw new Error("オークションIDが無効です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 3. オークションの検証
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
      throw new Error(validation.message || "検証エラー");
    }

    // バリデーションに成功した場合は、ユーザーIDとオークション情報を取得
    const userId = validation.userId;
    const auction = validation.auction;

    // オークション情報が取得できなかった場合はエラーを返す
    if (!auction) {
      throw new Error("オークション情報が取得できませんでした");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 4. 自動入札の上限入札額が現在の最高入札額より高いか確認
     */
    if (maxBidAmount <= auction.currentHighestBid) {
      throw new Error("最大入札額は現在の最高入札額より高く設定してください");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 5. 自動入札の設定を保存（upsert）
     */
    const upsertAutoBid = await prisma.autoBid.upsert({
      where: {
        userId_auctionId: {
          userId,
          auctionId,
        },
      },
      update: {
        maxBidAmount,
        bidIncrement,
        isActive: true,
      },
      create: {
        auctionId,
        userId,
        maxBidAmount,
        bidIncrement,
        isActive: true,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 6. 新しい自動入札設定後に即時の自動入札処理を実行
     * 自動入札設定後、現在の最高入札者が自分でない場合は自動入札処理を実行
     */
    try {
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

    /**
     * 7. 自動入札設定成功を返す
     */
    return {
      success: true,
      message: "自動入札を設定しました",
      data: {
        id: upsertAutoBid.id,
        maxBidAmount: upsertAutoBid.maxBidAmount,
        bidIncrement: upsertAutoBid.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("自動入札設定エラー:", error);
    return {
      success: false,
      message: `${error instanceof Error ? error.message : "不明なエラーが発生しました"}`,
      data: null,
    };
  }
}
