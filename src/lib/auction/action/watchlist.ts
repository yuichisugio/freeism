"use server";

import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリストの切り替え
 * @param auctionId オークションID
 * @param userId ユーザーID
 * @param isWatchlisted ウォッチリストの状態
 * @returns ウォッチリストの状態
 */
export async function serverToggleWatchlist(auctionId: string, userId: string, isWatchlisted: boolean): Promise<boolean> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションIDまたはユーザーIDが存在しない場合はエラーを返す
    if (!auctionId || !userId) {
      throw new Error("serverToggleWatchlist: オークションIDまたはユーザーIDが存在しません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // ウォッチリストの状態を確認
    if (isWatchlisted) {
      // 存在する場合は削除
      await prisma.taskWatchList.delete({
        where: {
          userId_auctionId: {
            userId,
            auctionId,
          },
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
