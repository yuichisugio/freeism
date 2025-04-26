"use server";

import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { type AuctionWithDetails } from "@/lib/auction/type/types";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションIDに関連するオークション情報を取得
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getAuctionByAuctionId(auctionId: string): Promise<AuctionWithDetails | null> {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: {
          include: {
            group: true,
            creator: true,
            executors: true,
          },
        },
        currentHighestBidder: true,
        winner: true,
        bidHistories: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1, // 1件多く取得して、２５＋１にしたい
        },
      },
    });

    if (!auction) return null;

    console.log("auction-retrieve.ts_getAuctionByAuctionId_auction_success");

    // 必要なプロパティを持つオブジェクトとして返す
    return auction as unknown as AuctionWithDetails;
  } catch (error) {
    console.error("オークション取得エラー:", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクIDに関連するオークション情報を取得
 * @param taskId タスクID
 * @returns オークション情報
 */
export async function getAuctionWithTask(taskId: string): Promise<AuctionWithDetails | null> {
  try {
    console.log("auction-retrieve.ts_getAuctionWithTask_start");

    // タスクIDが指定されていない場合はエラーを返す
    if (!taskId) {
      console.error("getAuctionWithTask: タスクIDが指定されていません");
      return null;
    }

    console.log(`getAuctionWithTask: タスクID=${taskId}の検索を実行`);

    const auction = await prisma.auction.findUnique({
      where: { taskId },
      include: {
        task: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
                createdAt: true,
              },
            },
            group: true,
          },
        },
        bidHistories: {
          orderBy: { createdAt: "desc" },
          take: AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1, // 1件多く取得して、２５＋１にしたい
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        watchlists: true,
      },
    });

    console.log("auction-retrieve.ts_getAuctionWithTask_auction", auction?.task.creatorId);

    // オークションが見つからない場合はエラーを返す
    if (!auction) {
      console.error(`getAuctionWithTask: タスクID=${taskId}のオークションが見つかりませんでした`);
      return null;
    }

    console.log(`getAuctionWithTask: タスクID=${taskId}のオークション情報を取得しました`);

    // 必要なプロパティを持つオブジェクトとして返す
    return auction as unknown as AuctionWithDetails;
  } catch (error) {
    console.error(`オークション取得エラー: タスクID=${taskId}`, error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
