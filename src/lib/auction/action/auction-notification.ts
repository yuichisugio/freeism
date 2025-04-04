"use server";

import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの通知を行う関数
 * @param auctionId オークションID
 * @param bidId 入札ID
 * @returns 通知処理の結果
 */
// export async function getAuctionNotificationMessage(eventType: AuctionEventType, auctionId: string, bidId: string): Promise<{ success: boolean }> {
//   return { success: true };
// }

/**
 * 新規入札通知を行う関数
 * @param auctionId オークションID
 * @param bidId 入札ID
 * @returns 通知処理の結果
 */
export async function notifyNewBid(auctionId: string, bidId: string): Promise<{ success: boolean }> {
  try {
    // 入札情報を取得
    const bid = await prisma.bidHistory.findUnique({
      where: { id: bidId },
      include: { user: true },
    });

    if (!bid) {
      console.error(`入札情報が見つかりません ID: ${bidId}`);
      return { success: false };
    }

    // オークション情報を取得
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: {
          include: {
            creator: true,
            group: true,
          },
        },
        bidHistories: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!auction) {
      console.error(`オークション情報が見つかりません ID: ${auctionId}`);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error("入札通知処理エラー:", error);
    return { success: false };
  }
}
