"use server";

import { AUCTION_CONSTANTS } from "@/lib/auction/constants";
import { type AuctionWithDetails, type UpdateAuctionWithDetails } from "@/lib/auction/type/types";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション情報を取得
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getUpdatedAuctionByAuctionId(auctionId: string): Promise<UpdateAuctionWithDetails | null> {
  const updatedAuction: UpdateAuctionWithDetails | null = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: AUCTION_CONSTANTS.UPDATE_AUCTION_SELECT,
  });

  return updatedAuction;
}

/**
 * オークションIDに関連するオークション情報を取得
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getAuctionByAuctionId(auctionId: string, currentUserId: string): Promise<AuctionWithDetails | null> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ログ
    console.log("src/lib/auction/action/auction-retrieve.ts_getAuctionByAuctionId_start");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションIDが指定されていない場合はエラーを返す
    if (!auctionId) {
      console.error("src/lib/auction/action/auction-retrieve.ts_getAuctionByAuctionId_error_auctionId_not_specified");
      return null;
    }
    console.log("src/lib/auction/action/auction-retrieve.ts_getAuctionByAuctionId_auctionId", auctionId);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークション情報を取得
    const auction: AuctionWithDetails | null = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        currentHighestBid: true,
        currentHighestBidderId: true,
        status: true,
        extensionTotalCount: true,
        extensionLimitCount: true,
        extensionTotalTime: true,
        extensionLimitTime: true,
        bidHistories: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
            isAutoBid: true,
            user: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1, // 1件多く取得して、２５＋１にしたい
        },
        task: {
          select: {
            task: true,
            detail: true,
            imageUrl: true,
            status: true,
            category: true,
            group: {
              select: {
                id: true,
                name: true,
                depositPeriod: true,
              },
            },
            creator: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        watchlists: {
          where: {
            userId: currentUserId,
          },
          select: {
            id: true,
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (!auction) return null;

    console.log("src/lib/auction/action/auction-retrieve.ts_getAuctionByAuctionId_auction_success", auction);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return auction;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("src/lib/auction/action/auction-retrieve.ts_getAuctionByAuctionId_error", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
