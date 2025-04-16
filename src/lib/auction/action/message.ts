import { revalidatePath } from "next/cache";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { AuctionEventType, NotificationSendMethod } from "@prisma/client";

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getAuctionMessages(auctionId: string) {
  try {
    const messages = await prisma.auctionMessage.findMany({
      where: {
        auctionId,
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
      orderBy: {
        createdAt: "asc",
      },
    });

    return { success: true, messages };
  } catch (error) {
    console.error("メッセージ取得エラー:", error);
    return { success: false, error: "メッセージの取得に失敗しました" };
  }
}

/**
 * オークションに関連するメッセージを送信する
 * @param auctionId オークションID
 * @param message メッセージ内容
 * @param recipientId 受信者ID（出品者または「全体」）
 * @returns 作成されたメッセージ
 */
export async function sendAuctionMessage(auctionId: string, message: string, recipientId: string) {
  try {
    const userId = await getAuthenticatedSessionUserId();

    // メッセージの作成
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

    // オークション情報を取得（通知に必要なタイトルを取得するため）
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: true,
      },
    });

    // 出品者IDがrecipientIdと一致する場合（出品者に対するメッセージの場合）のみ通知を送る
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

    // パスを再検証
    revalidatePath(`/auction/${auctionId}`);

    return { success: true, message: newMessage };
  } catch (error) {
    console.error("メッセージ送信エラー:", error);
    return { success: false, error: "メッセージの送信に失敗しました" };
  }
}

/**
 * オークション情報を取得して、出品者IDを返す
 * @param auctionId オークションID
 * @returns 出品者ID
 */
export async function getAuctionSellerInfo(auctionId: string) {
  try {
    const auction = await prisma.auction.findUnique({
      where: {
        id: auctionId,
      },
      select: {
        task: {
          select: {
            creatorId: true,
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!auction) {
      return { success: false, error: "オークションが見つかりません" };
    }

    return {
      success: true,
      sellerId: auction.task?.creatorId,
      sellerInfo: auction.task?.creator,
    };
  } catch (error) {
    console.error("出品者情報取得エラー:", error);
    return { success: false, error: "出品者情報の取得に失敗しました" };
  }
}
