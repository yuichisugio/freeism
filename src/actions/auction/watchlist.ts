"use server";

import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ウォッチリストの切り替え
 * @param auctionId オークションID
 * @param userId ユーザーID
 * @param isWatchlisted ウォッチリストの状態
 * @returns ウォッチリストの状態
 */
export async function serverToggleWatchlist(
  auctionId: string,
  userId: string,
  isWatchlisted: boolean,
): PromiseResult<boolean> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 1. オークションIDまたはユーザーIDが存在しない場合はエラーを返す
     */
    if (!auctionId || !userId) {
      throw new Error("serverToggleWatchlist: オークションIDまたはユーザーIDが存在しません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. ウォッチリストの状態を確認
     */
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
      return {
        success: true,
        message: "ウォッチリストから削除しました",
        data: false,
      };
    } else {
      // 存在しない場合は追加
      await prisma.taskWatchList.create({
        data: {
          userId,
          auctionId,
        },
      });
      return {
        success: true,
        message: "ウォッチリストに追加しました",
        data: true,
      };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 3. エラー処理
     */
  } catch (error) {
    console.error("ウォッチリスト操作エラー:", error);
    return {
      success: false,
      message: `ウォッチリストの更新中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      data: false,
    };
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
