"use server";

import { getCachedAuctionByAuctionId } from "@/actions/auction/cache/cache-auction-retrieve";
import { AUCTION_CONSTANTS, getAuctionUpdateSelect } from "@/lib/constants";
import { prisma } from "@/library-setting/prisma";
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
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションIDが指定されていない場合はエラーを返す
     */
    if (!auctionId) throw new Error("オークションIDが指定されていません");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークション情報を取得
     */
    const updatedAuctionRaw = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: getAuctionUpdateSelect(AUCTION_CONSTANTS.DISPLAY.BID_HISTORY_LIMIT + 1),
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークション情報が見つからない場合
     */
    if (!updatedAuctionRaw) throw new Error("オークション情報が見つかりません");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークション情報を更新
     */
    const updatedAuction: UpdateAuctionWithDetails = {
      id: updatedAuctionRaw.id,
      currentHighestBid: updatedAuctionRaw.currentHighestBid,
      currentHighestBidderId: updatedAuctionRaw.currentHighestBidderId,
      status: updatedAuctionRaw.task.status, // TaskStatusで統一
      extensionTotalCount: updatedAuctionRaw.extensionTotalCount,
      extensionLimitCount: updatedAuctionRaw.extensionLimitCount,
      extensionTime: updatedAuctionRaw.extensionTime,
      remainingTimeForExtension: updatedAuctionRaw.remainingTimeForExtension,
      bidHistories: updatedAuctionRaw.bidHistories.map((bid) => {
        return bid as unknown as {
          id: string;
          amount: number;
          createdAt: Date | string;
          isAutoBid: boolean;
          user: { settings: { username: string } | null };
        };
      }),
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークション情報を返す
     */
    return updatedAuction;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("src/lib/auction/action/auction-retrieve.ts_getUpdatedAuctionByAuctionId_error", error);
    throw new Error(`${error instanceof Error ? error.message : "不明なエラーが発生しました"}`);
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
export async function getAuctionByAuctionId(auctionId: string): Promise<AuctionWithDetails> {
  return await getCachedAuctionByAuctionId(auctionId);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
