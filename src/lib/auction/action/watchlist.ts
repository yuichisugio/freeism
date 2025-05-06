"use server";

import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリストの切り替え
 * @param auctionId オークションID
 * @param userId ユーザーID
 * @returns ウォッチリストの状態
 */
export async function serverToggleWatchlist(auctionId: string, userId: string): Promise<boolean> {
  try {
    // 既存のウォッチリスト項目を確認
    const existingItem = await prisma.taskWatchList.findFirst({
      where: {
        userId,
        auctionId,
      },
    });

    if (existingItem) {
      // 存在する場合は削除
      await prisma.taskWatchList.delete({
        where: {
          id: existingItem.id,
        },
      });
      return false;
    } else {
      // 存在しない場合は追加
      await prisma.taskWatchList.create({
        data: {
          userId,
          auctionId,
        },
      });
      return true;
    }
  } catch (error) {
    console.error("ウォッチリスト操作エラー:", error);
    return false;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションがウォッチリストに登録されているか確認
 * @param auctionId オークションID
 * @param userId ユーザーID
 * @returns ウォッチリストの状態
 */
export async function serverIsAuctionWatched(auctionId: string, userId: string): Promise<boolean> {
  try {
    const watchlistItem = await prisma.taskWatchList.findFirst({
      where: {
        userId,
        auctionId,
      },
      select: {
        id: true,
      },
    });

    return !!watchlistItem;
  } catch (error) {
    console.error("ウォッチリスト状態確認エラー:", error);
    return false;
  }
}
