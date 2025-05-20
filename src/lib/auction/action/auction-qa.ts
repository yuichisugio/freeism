"use server";

import { revalidateTag } from "next/cache";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { AuctionEventType, NotificationSendMethod } from "@prisma/client";

import { getCachedAuctionMessageContents, getCachedAuctionSellerInfo } from "./cache/cache-auction-qa";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getAuctionMessagesAndSellerInfo(auctionId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    /**
     * キャッシュからメッセージを取得
     */
    const [messages, sellerInfo] = await Promise.all([getCachedAuctionMessageContents(auctionId), getCachedAuctionSellerInfo(auctionId)]);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュからメッセージを取得できなかった場合
     */
    if (!messages.success || !sellerInfo.success) {
      return { success: false, error: messages.error || sellerInfo.error };
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
  } catch (error) {
    console.error("メッセージ取得エラー:", error);
    return { success: false, error: "メッセージの取得に失敗しました" };
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
export async function sendAuctionMessage(auctionId: string, message: string, recipientIds: string[]) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージのキャッシュの更新に必要。
   */
  revalidateTag(`auction-messages-${auctionId}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  try {
    /**
     * セッション中のuserIdを取得
     */
    const senderUserId = await getAuthenticatedSessionUserId();

    /**
     * メッセージの作成
     */
    const newMessage = await prisma.auctionMessage.create({
      data: {
        message,
        auctionId,
        senderId: senderUserId,
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
      if (recipientId === senderUserId) {
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
        sendTiming: "NOW",
        sendScheduledDate: null,
        expiresAt: null,
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功
     */
    return { success: true, message: newMessage };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
    return { success: false, error: "メッセージの送信に失敗しました" };
  }
}
