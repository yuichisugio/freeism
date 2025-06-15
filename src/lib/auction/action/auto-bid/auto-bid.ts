"use server";

import type { ValidateAuctionResult } from "@/lib/auction/action/bid-validation";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { validateAuction } from "@/lib/auction/action/bid-validation";
import { executeBid } from "@/lib/auction/action/bid/bid-common";
import { prisma } from "@/lib/prisma";
import { NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札処理の応答型
 */
export type ExecuteAutoBidReturn = {
  success: boolean;
  message: string;
  autoBid: {
    id: string;
    maxBidAmount: number;
    bidIncrement: number;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札処理のパラメータ型
 */
export type ExecuteAutoBidParams = {
  auctionId: string;
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  validationDone: boolean;
  paramsValidationResult: ValidateAuctionResult | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札処理を実行する
 * @param params 自動入札処理パラメータ
 * @returns 処理結果または null（自動入札が実行されなかった場合）
 */
export async function executeAutoBid(params: ExecuteAutoBidParams): Promise<ExecuteAutoBidReturn> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. パラメータの分解
     */
    const { auctionId, currentHighestBid, currentHighestBidderId, validationDone, paramsValidationResult } = params;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. オークションの存在確認と基本的なバリデーション
     */
    // 入札時の自動入札チェックの場合は、事前にバリデーションを行っているためスキップ
    let validationResult = paramsValidationResult;
    if (!validationDone && !validationResult) {
      validationResult = await validateAuction(auctionId, {
        checkEndTime: true,
        requireActive: true,
        checkSelfListing: null,
        checkCurrentBid: null,
        currentBid: null,
        executeBid: null,
      });
    }

    // バリデーションに失敗した場合はエラーを返す
    if (!validationResult || !validationResult.success || !validationResult.auction) {
      console.error("自動入札処理: オークションのバリデーションに失敗しました", validationResult?.message);
      throw new Error(validationResult?.message ?? "検証エラー");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 3. 自動入札設定の取得（現在の最高入札額より高いもののみ）
     */
    const autoBids = await prisma.autoBid.findMany({
      where: {
        auctionId, // オークションID
        maxBidAmount: { gt: currentHighestBid }, // 現在の最高入札額より高い設定
        ...(currentHighestBidderId ? { userId: { not: currentHighestBidderId } } : {}), // 現在の最高入札者の自動入札は除外して取得
        isActive: true, // 有効な自動入札設定
      },
      select: {
        id: true,
        maxBidAmount: true,
        bidIncrement: true,
        userId: true,
      },
      orderBy: [
        { maxBidAmount: "desc" }, // 上限額の降順で取得
        { createdAt: "asc" }, // 同額の場合は先に設定したものを優先
      ],
    });

    // 自動入札設定がない場合は処理終了
    if (autoBids.length === 0) {
      return {
        success: true,
        message: "自動入札の設定はありません。処理をスキップします",
        autoBid: null,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 4. 不要だけど、一応現在の最高入札額より高い自動入札の設定があるかチェック
     */
    if (!autoBids.some((autoBid) => autoBid.maxBidAmount > currentHighestBid)) {
      throw new Error("現在の最高入札額より高い自動入札の設定がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (currentHighestBid < 0 || autoBids.some((autoBid) => autoBid.bidIncrement < 0)) {
      throw new Error("現在の最高入札額が0以下か、入札単位が0以下です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 4. 最高上限額を持つ自動入札とユーザーを特定
     */
    const highestAutoBid = autoBids[0];

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 5. 自動入札で入札する額の計算
     */
    let newBidAmount = 0;

    // 自動入札の設定が複数ある場合、2番目に高い上限額 + 最高上限額設定者の入札単位を入札
    if (autoBids.length > 1) {
      // 2番目に高い上限額を取得
      const secondHighestMaxBid = autoBids[1].maxBidAmount;
      // 最高上限額設定者の入札単位を取得
      const bidIncrement = highestAutoBid.bidIncrement;
      // 2番目に高い上限額 + 最高上限額設定者の入札単位で、入札額を計算
      newBidAmount = secondHighestMaxBid + bidIncrement;
    } else {
      // 自動入札の設定が1つだけの場合は、現在の最高入札額 + 入札単位
      newBidAmount = currentHighestBid + highestAutoBid.bidIncrement;
    }

    // 上限入札額を超える場合は、上限額に設定
    if (newBidAmount > highestAutoBid.maxBidAmount) {
      newBidAmount = highestAutoBid.maxBidAmount;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 6. 自動入札を実行
     */
    const bidResult = await executeBid(auctionId, newBidAmount, true, highestAutoBid.userId);

    // 入札に失敗した場合はエラーを返す
    if (!bidResult.success) {
      console.error("自動入札実行エラー: 入札に失敗しました", bidResult.message);
      throw new Error(bidResult.message ?? "入札エラー");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 7. 最高入札額に設定している人の入札額が上限額に達したかチェック
     * 上限に達した場合は自動入札を無効化
     */
    // 最高入札額に設定している人の入札額が上限額に達したかチェック
    if (newBidAmount >= highestAutoBid.maxBidAmount) {
      // 上限に達したので自動入札を無効化
      await prisma.autoBid.update({
        where: { id: highestAutoBid.id },
        data: { isActive: false },
      });

      // 上限到達通知を送信
      await sendAuctionNotification({
        text: {
          first: validationResult.auction?.task?.task ?? "オークション",
          second: newBidAmount.toString(),
        },
        auctionEventType: PrismaAuctionEventType.AUTO_BID_LIMIT_REACHED,
        auctionId,
        recipientUserId: [highestAutoBid.userId],
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
        actionUrl: validationResult.auction.taskId ? `/dashboard/auction/${validationResult.auction.taskId}` : null,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 8. 自動入札処理の結果を返す
     */
    return {
      success: true,
      message: "自動入札が完了しました",
      autoBid: {
        id: highestAutoBid.id,
        maxBidAmount: highestAutoBid.maxBidAmount,
        bidIncrement: highestAutoBid.bidIncrement,
      },
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
    /**
     * 9. エラー時の処理
     */
  } catch (error) {
    console.error("自動入札処理でエラーが発生しました:", error);
    throw new Error(`自動入札処理でエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
  }
}
