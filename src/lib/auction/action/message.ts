"use server";

import { revalidateTag } from "next/cache";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { AuctionEventType, NotificationSendMethod } from "@prisma/client";

import { getCachedAuctionMessages, getCachedAuctionSellerInfo } from "./cache/cache-auction-message";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getAuctionMessagesAndSellerInfo(auctionId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // キャッシュからメッセージを取得
    const [messages, sellerInfo] = await Promise.all([getCachedAuctionMessages(auctionId), getCachedAuctionSellerInfo(auctionId)]);

    if (!messages.success || !sellerInfo.success) {
      return { success: false, error: "メッセージの取得に失敗しました" };
    }

    return {
      success: true,
      messages: messages.messages,
      sellerInfo: sellerInfo.sellerInfo,
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
 * @param recipientId 受信者ID（出品者または「全体」）
 * @returns 作成されたメッセージ
 */
export async function sendAuctionMessage(auctionId: string, message: string, recipientId: string) {
  revalidateTag(`auction-messages-${auctionId}`);
  try {
    /**
     * セッション中のuserIdを取得
     */
    const userId = await getAuthenticatedSessionUserId();

    /**
     * メッセージの作成
     */
    const newMessage = await prisma.auctionMessage.create({
      data: {
        message,
        auctionId,
        senderId: userId,
        recipientId, // 特定のユーザーまたは出品者
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    /**
     * オークション情報を取得（通知に必要なタイトルを取得するため）
     */
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: true,
      },
    });

    /**
     * 出品者IDがrecipientIdと一致する場合（出品者に対するメッセージの場合）のみ通知を送る
     */
    if (auction?.task?.creatorId === recipientId && userId !== recipientId) {
      await sendAuctionNotification({
        text: {
          first: auction.task.task || "出品商品",
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

    /**
     * メッセージのキャッシュの更新に必要。
     * SSEがリロードされるがしょうがない。
     */
    revalidateTag(`auction-messages-${auctionId}`);

    return { success: true, message: newMessage };
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
    return { success: false, error: "メッセージの送信に失敗しました" };
  }
}
