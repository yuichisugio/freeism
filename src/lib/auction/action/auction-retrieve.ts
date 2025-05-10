"use server";

import { getCachedAuctionByAuctionId } from "@/lib/auction/action/cache/cache-auction-retrieve";
import { AUCTION_CONSTANTS, getAuctionUpdateSelect } from "@/lib/auction/constants";
import { prisma } from "@/lib/prisma";
import { type AuctionWithDetails, type UpdateAuctionWithDetails } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション情報を取得。
 * SSEで取得するため、CACHEがNG
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getUpdatedAuctionByAuctionId(auctionId: string): Promise<UpdateAuctionWithDetails | null> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ログ
    console.log("src/lib/auction/action/auction-retrieve.ts_getUpdatedAuctionByAuctionId_start");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const updatedAuction: UpdateAuctionWithDetails | null = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: getAuctionUpdateSelect(AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1),
    });

    return updatedAuction;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("src/lib/auction/action/auction-retrieve.ts_getUpdatedAuctionByAuctionId_error", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションIDに関連するオークション情報を取得
 * オークション情報全般なので、キャッシュを使用する。
 * 更新が必要な情報は、SSE接続の処理情報として最新のデータを別で取得するので問題はない
 * @param auctionId オークションID
 * @returns オークション情報
 */
export async function getAuctionByAuctionId(auctionId: string): Promise<AuctionWithDetails | null> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ログ
    console.log("src/lib/auction/action/auction-retrieve.ts_getAuctionByAuctionId_start");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    const auction = await getCachedAuctionByAuctionId(auctionId);

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
