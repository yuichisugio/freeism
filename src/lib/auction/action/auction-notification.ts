"use server";

import { sendNewBidEvent } from "@/lib/auction/action/server-sent-events-broadcast";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

    // リアルタイム通知イベントを送信
    await sendNewBidEvent(
      auctionId,
      {
        id: bid.id,
        userId: bid.userId,
        amount: bid.amount,
        createdAt: bid.createdAt.toISOString(),
        auctionId: bid.auctionId,
        isAutoBid: bid.isAutoBid,
        user: bid.user
          ? {
              id: bid.user.id,
              username: bid.user.name ?? "",
              email: bid.user.email ?? "",
              name: bid.user.name,
              emailVerified: bid.user.emailVerified,
              image: bid.user.image,
              isAppOwner: bid.user.isAppOwner ?? false,
              createdAt: bid.user.createdAt.toISOString(),
              updatedAt: bid.user.updatedAt,
              avatarUrl: bid.user.image ?? undefined,
            }
          : undefined,
      },
      {
        id: auction.id,
        createdAt: auction.createdAt,
        updatedAt: auction.updatedAt,
        status: auction.status,
        taskId: auction.taskId,
        startTime: auction.startTime,
        endTime: auction.endTime,
        currentHighestBid: auction.currentHighestBid,
        currentHighestBidderId: auction.currentHighestBidderId,
        bidHistories: auction.bidHistories.map((history) => ({
          ...history,
          createdAt: history.createdAt.toISOString(),
        })),
        winnerId: auction.winnerId,
        extensionCount: auction.extensionCount,
        version: auction.version,
        title: auction.task.task ?? "",
        description: auction.task.detail ?? "",
        currentPrice: auction.currentHighestBid,
        sellerId: auction.task.creator.id,
        task: {
          ...auction.task,
          creator: {
            ...auction.task.creator,
            username: auction.task.creator.name ?? "",
            createdAt: auction.task.creator.createdAt.toISOString(),
          },
          group: auction.task.group,
        },
        depositPeriod: auction.task.group.depositPeriod,
        currentHighestBidder: null,
        winner: null,
        watchlists: [],
      },
    );

    return { success: true };
  } catch (error) {
    console.error("入札通知処理エラー:", error);
    return { success: false };
  }
}
