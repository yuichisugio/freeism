"use server";

import { revalidatePath } from "next/cache";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { NotificationSendMethod, NotificationSendTiming, AuctionEventType as PrismaAuctionEventType } from "@prisma/client";

import type { ValidateAuctionResult } from "./bid-common";
import { executeBid, validateAuction } from "./bid-common";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札処理の応答型
 */
export type AutoBidResponse = {
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
export type ProcessAutoBidParams = {
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
export async function processAutoBid(params: ProcessAutoBidParams): Promise<AutoBidResponse> {
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
      });
    }

    // バリデーションに失敗した場合はエラーを返す
    if (!validationResult || !validationResult.success || !validationResult.auction) {
      console.error("自動入札処理: オークションのバリデーションに失敗しました", validationResult?.message);
      return {
        success: false,
        message: validationResult?.message ?? "検証エラー",
        autoBid: null,
      };
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
        message: "自動入札がありません",
        autoBid: null,
      };
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
    const bidResult = await executeBid(auctionId, newBidAmount, true);

    // 入札に失敗した場合はエラーを返す
    if (!bidResult.success) {
      console.error("自動入札実行エラー:", bidResult.message);
      return {
        success: false,
        message: bidResult.message ?? "入札エラー",
        autoBid: null,
      };
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
    return {
      success: false,
      message: "自動入札処理でエラーが発生しました",
      autoBid: null,
    };
  }
}

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
    });

    // バリデーションに失敗した場合はエラーを返す
    if (!validation.success || !validation.userId) {
      return {
        success: false,
        message: validation.message ?? "検証エラー",
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
        const params: ProcessAutoBidParams = {
          auctionId,
          currentHighestBid: auction.currentHighestBid,
          currentHighestBidderId: auction.currentHighestBidderId,
          validationDone: true,
          paramsValidationResult: validation,
        };
        await processAutoBid(params);
      }
    } catch (autoBidError) {
      console.error("自動入札設定後の自動入札処理でエラーが発生:", autoBidError);
      // 自動入札処理でエラーが発生しても設定自体は成功しているので、設定成功を返す
    }

    // パスの再検証
    revalidatePath(`/auctions/${auctionId}`);

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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 自動入札設定を取得する
 * @param auctionId オークションID
 * @returns 処理結果
 */
export async function getAutoBidByUserId(auctionId: string): Promise<AutoBidResponse> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. オークションの検証（最小限のチェック）
     */
    const validation = await validateAuction(auctionId);

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
      },
    });

    if (!autoBid) {
      return {
        success: false,
        message: "自動入札設定がありません",
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
    const validation = await validateAuction(auctionId);

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

    // パスの再検証
    revalidatePath(`/auctions/${auctionId}`);

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
