"use server";

import { revalidateTag } from "next/cache";
import { sendAuctionNotification } from "@/actions/notification/auction-notification";
import { messageFormSchema } from "@/hooks/auction/bid/use-auction-qa";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";
import { AuctionEventType, NotificationSendMethod, NotificationSendTiming } from "@prisma/client";

import { getCachedAuctionMessageContents, getCachedAuctionSellerInfo } from "./cache/cache-auction-qa";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getAuctionMessagesAndSellerInfo(
  auctionId: string,
  isDisplayAfterEnd: boolean,
  auctionEndDate: Date,
) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    /**
     * バリデーション
     */
    if (!auctionId || typeof isDisplayAfterEnd !== "boolean" || !auctionEndDate?.getTime()) {
      throw new Error("パラメータが不正です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュからメッセージを取得
     */
    const [messages, sellerInfo] = await Promise.all([
      getCachedAuctionMessageContents(auctionId, isDisplayAfterEnd, auctionEndDate),
      getCachedAuctionSellerInfo(auctionId),
    ]);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュからメッセージを取得できなかった場合
     */
    if (!messages.success || !sellerInfo.success) {
      throw new Error(
        messages.error && sellerInfo.error ? messages.error + sellerInfo.error : messages.error || sellerInfo.error,
      );
    }

    if (!sellerInfo.auctionPersonInfo) {
      throw new Error("オークションが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功
     */
    return {
      success: true,
      messages: messages.messages,
      sellerInfo: sellerInfo.auctionPersonInfo,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("メッセージ取得エラー:", error);
    throw new Error(`メッセージの取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを送信する
 * @param auctionId オークションID
 * @param message メッセージ内容
 * @param recipientIds 受信者ID（出品者または「全体」）
 * @returns 作成されたメッセージ
 */
export async function sendAuctionMessage(
  auctionId: string,
  message: string,
  recipientIds: string[],
  currentUserId: string,
) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    /**
     * バリデーション
     */
    if (
      !auctionId ||
      message === undefined ||
      message === null ||
      !recipientIds ||
      !Array.isArray(recipientIds) ||
      !currentUserId
    ) {
      throw new Error("パラメータが不正です");
    }

    if (message.trim() === "" || !messageFormSchema.safeParse({ message: message }).success) {
      throw new Error("メッセージが空です");
    }

    if (recipientIds.length === 0) {
      throw new Error("受信者が指定されていません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メッセージの作成
     */
    const newMessage = await prisma.auctionMessage.create({
      data: {
        message,
        auctionId,
        senderId: currentUserId,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 送信者以外の出品者（作成者・報告者・実行者）に通知を送る
     */
    for (const recipientId of recipientIds) {
      /**
       * 送信者は通知を受け取らない
       */
      if (recipientId === currentUserId) {
        continue;
      }
      await sendAuctionNotification({
        text: {
          first: "出品者からメッセージが届きました",
          second: message.length > 50 ? message.substring(0, 50) + "..." : message,
        },
        auctionEventType: AuctionEventType.QUESTION_RECEIVED,
        auctionId,
        recipientUserId: [recipientId],
        sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.WEB_PUSH, NotificationSendMethod.EMAIL],
        actionUrl: `/auction/${auctionId}`,
        sendTiming: NotificationSendTiming.NOW,
        sendScheduledDate: null,
        expiresAt: null,
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メッセージのキャッシュの更新に必要。
     */
    revalidateTag(useCacheKeys.auctionQa.auctionByAuctionId(auctionId).join(":"));

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功
     */
    return { success: true, message: newMessage };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
    throw new Error(`${error instanceof Error ? error.message : "不明なエラー"}`);
  }
}
