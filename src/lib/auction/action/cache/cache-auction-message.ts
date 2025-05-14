"use cache";

import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションに関連するメッセージを取得する
 * @param auctionId オークションID
 * @returns メッセージリスト
 */
export async function getCachedAuctionMessages(auctionId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの設定
   */
  cacheTag(`auction-messages-${auctionId}`);
  cacheLife("hours");
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功
     */
    return { success: true, messages };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("メッセージ取得エラー:", error);
    return { success: false, error: "メッセージの取得に失敗しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション情報を取得して、出品者IDを返す
 * @param auctionId オークションID
 * @returns 出品者ID
 */
export async function getCachedAuctionSellerInfo(auctionId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    /**
     * オークション情報を取得
     */
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

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションが見つからない場合
     */
    if (!auction) {
      return { success: false, error: "オークションが見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功
     */
    return {
      success: true,
      sellerId: auction.task?.creatorId,
      sellerInfo: auction.task?.creator,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("出品者情報取得エラー:", error);
    return { success: false, error: "出品者情報の取得に失敗しました" };
  }
}
