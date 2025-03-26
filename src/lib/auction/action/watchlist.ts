"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { getCurrentUserId } from "./user";

/**
 * クライアントサイドからも呼び出せるウォッチリスト切り替え関数
 * @param auctionId オークションID
 * @returns ウォッチリストの新しい状態
 */
export async function toggleWatchlist(auctionId: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("ログインが必要です");
  }

  // 現在のウォッチリスト状態を確認
  const existingWatchlist = await prisma.taskWatchList.findUnique({
    where: {
      userId_auctionId: {
        userId,
        auctionId,
      },
    },
  });

  // 存在する場合は削除、存在しない場合は作成
  if (existingWatchlist) {
    await prisma.taskWatchList.delete({
      where: {
        id: existingWatchlist.id,
      },
    });
    return { isWatched: false };
  } else {
    await prisma.taskWatchList.create({
      data: {
        userId,
        auctionId,
      },
    });
    return { isWatched: true };
  }
}

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
    });

    return !!watchlistItem;
  } catch (error) {
    console.error("ウォッチリスト状態確認エラー:", error);
    return false;
  }
}

/**
 * ウォッチリストの切り替えを行うサーバーアクション
 * @param auctionId オークションID
 * @returns 操作結果（成功/失敗、メッセージ、ウォッチリスト状態）
 */
export async function toggleWatchlistAction(auctionId: string) {
  // 認証セッションを取得
  const session = await auth();
  if (!session || !session.user) {
    return {
      success: false,
      message: "ログインが必要です",
      isWatched: null,
    };
  }

  const userId = session.user.id;
  if (!userId) {
    return {
      success: false,
      message: "ユーザーIDが取得できません",
      isWatched: null,
    };
  }

  try {
    // ウォッチリストの切り替え処理を実行
    const isWatched = await serverToggleWatchlist(auctionId, userId);

    return {
      success: true,
      isWatched,
      message: isWatched ? "ウォッチリストに追加しました" : "ウォッチリストから削除しました",
    };
  } catch (error) {
    console.error("ウォッチリスト切り替えエラー:", error);
    return {
      success: false,
      message: "ウォッチリストの更新中にエラーが発生しました",
      isWatched: null,
    };
  }
}

/**
 * ウォッチリストの状態を取得するサーバーアクション
 * @param auctionId オークションID
 * @returns ウォッチリストの状態
 */
export async function getWatchlistStatusAction(auctionId: string) {
  // 認証セッションを取得
  const session = await auth();
  if (!session || !session.user) {
    return {
      success: false,
      isWatched: false,
    };
  }

  const userId = session.user.id;
  if (!userId) {
    return {
      success: false,
      isWatched: false,
    };
  }

  try {
    // ウォッチリストの状態を確認
    const isWatched = await serverIsAuctionWatched(auctionId, userId);

    return {
      success: true,
      isWatched,
    };
  } catch (error) {
    console.error("ウォッチリスト状態取得エラー:", error);
    return {
      success: false,
      isWatched: false,
    };
  }
}
