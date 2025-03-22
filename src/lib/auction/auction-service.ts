import type { Auction, BidHistory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuctionStatus, BidStatus, Task, User } from "@prisma/client";

import { AUCTION_END_EXTENSION } from "./constants";
import { type AuctionWithDetails, type BidFormData, type BidHistoryWithUser } from "./types";

/**
 * タスクIDに関連するオークション情報を取得
 */
export async function getAuctionWithTask(taskId: string): Promise<AuctionWithDetails | null> {
  const auction = await prisma.auction.findUnique({
    where: { taskId },
    include: {
      task: {
        include: {
          group: true,
          creator: true,
        },
      },
      currentHighestBidder: true,
      winner: true,
      bids: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!auction) return null;

  // 必要なプロパティを持つオブジェクトとして返す
  return auction as unknown as AuctionWithDetails;
}

/**
 * オークションの現在のステータスを取得
 */
export function getAuctionStatus(auction: Auction): "upcoming" | "active" | "ended" {
  const now = new Date();

  if (now < auction.startTime) {
    return "upcoming";
  } else if (now > auction.endTime) {
    return "ended";
  } else {
    return "active";
  }
}

/**
 * 入札可能か確認する
 */
export async function canPlaceBid(auction: AuctionWithDetails, userId: string | undefined, bidAmount: number): Promise<{ canBid: boolean; message?: string }> {
  // ユーザーIDが指定されていない場合は入札不可
  if (!userId) {
    return { canBid: false, message: "認証が必要です" };
  }

  // オークションのステータスを確認
  const status = getAuctionStatus(auction);

  // 開催前または終了済みの場合は入札不可
  if (status === "upcoming") {
    return { canBid: false, message: "オークションはまだ開始していません" };
  }

  if (status === "ended") {
    return { canBid: false, message: "オークションは終了しました" };
  }

  // 出品者（タスク作成者）は入札不可
  if (auction.task.creatorId === userId) {
    return { canBid: false, message: "自分のオークションには入札できません" };
  }

  // 最低入札金額を確認（現在の最高入札額+1ポイント以上）
  const minimumBid = auction.currentHighestBid + 1;
  if (bidAmount < minimumBid) {
    return {
      canBid: false,
      message: `最低入札金額（${minimumBid}ポイント）以上を入力してください`,
    };
  }

  // ユーザーのポイント残高を確認
  const userPointBalance = await getUserPointBalance(userId, auction.task.groupId);
  if (userPointBalance < bidAmount) {
    return {
      canBid: false,
      message: `ポイント残高が不足しています（残高: ${userPointBalance}ポイント）`,
    };
  }

  return { canBid: true };
}

/**
 * ユーザーのポイント残高を取得
 */
export async function getUserPointBalance(userId: string, groupId: string): Promise<number> {
  const groupPoint = await prisma.groupPoint.findUnique({
    where: {
      userId_groupId: {
        userId,
        groupId,
      },
    },
  });

  return groupPoint?.balance || 0;
}

/**
 * 入札を行う
 */
export async function placeBid(auctionId: string, bidData: BidFormData, userId: string | undefined): Promise<{ success: boolean; message?: string; bid?: BidHistory }> {
  try {
    // ユーザーIDが指定されていない場合はエラー
    if (!userId) {
      return { success: false, message: "認証が必要です" };
    }

    // オークション情報を取得
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!auction) {
      return { success: false, message: "オークションが見つかりません" };
    }

    // 入札可能か確認
    const auctionWithDetails = {
      ...auction,
      task: auction.task,
      currentHighestBidder: null,
      winner: null,
      bids: [],
    };

    const canBidResult = await canPlaceBid(auctionWithDetails, userId, bidData.amount);
    if (!canBidResult.canBid) {
      return { success: false, message: canBidResult.message };
    }

    // 入札履歴を作成
    const bid = await prisma.bidHistory.create({
      data: {
        auctionId,
        userId,
        amount: bidData.amount,
        isAutoBid: bidData.isAutoBid || false,
        status: "BIDDING",
      },
      include: {
        user: true,
      },
    });

    // オークション情報を更新
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        currentHighestBid: bidData.amount,
        currentHighestBidderId: userId,
      },
    });

    // 自動入札の場合は設定を保存/更新
    if (bidData.isAutoBid && bidData.maxAmount) {
      // 既存の自動入札設定を確認
      const existingAutoBid = await prisma.autoBid.findUnique({
        where: {
          userId_auctionId: {
            userId,
            auctionId,
          },
        },
      });

      if (existingAutoBid) {
        // 既存設定を更新
        await prisma.autoBid.update({
          where: {
            id: existingAutoBid.id,
          },
          data: {
            maxBidAmount: bidData.maxAmount,
            bidIncrement: 1, // 最小単位は1ポイント
            isActive: true,
            lastBidTime: new Date(),
          },
        });
      } else {
        // 新規設定を作成
        await prisma.autoBid.create({
          data: {
            userId,
            auctionId,
            maxBidAmount: bidData.maxAmount,
            bidIncrement: 1,
            isActive: true,
            lastBidTime: new Date(),
          },
        });
      }
    }

    return {
      success: true,
      bid: bid as BidHistory,
      message: bidData.isAutoBid ? "自動入札を設定しました" : undefined,
    };
  } catch (error) {
    console.error("入札処理エラー:", error);
    return { success: false, message: "入札処理中にエラーが発生しました" };
  }
}

/**
 * オークションの入札履歴を取得
 */
export async function getAuctionBidHistory(auctionId: string, limit = 20): Promise<BidHistoryWithUser[]> {
  const bids = await prisma.bidHistory.findMany({
    where: { auctionId },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return bids as BidHistoryWithUser[];
}

/**
 * ウォッチリストの状態を切り替え
 */
export async function toggleWatchlist(userId: string | undefined, auctionId: string): Promise<boolean> {
  // ユーザーIDが指定されていない場合は何もしない
  if (!userId) {
    return false;
  }

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

      // オークションのウォッチ数を更新（実際のアプリケーションではトリガーやフックで行うかも）
      // この実装は省略

      return false;
    } else {
      // 存在しない場合は追加
      await prisma.taskWatchList.create({
        data: {
          userId,
          auctionId,
        },
      });

      // オークションのウォッチ数を更新（実際のアプリケーションではトリガーやフックで行うかも）
      // この実装は省略

      return true;
    }
  } catch (error) {
    console.error("ウォッチリスト操作エラー:", error);
    return false;
  }
}

/**
 * オークションがウォッチリストに追加されているかを確認
 */
export async function isAuctionWatched(userId: string | undefined, auctionId: string): Promise<boolean> {
  // ユーザーIDが指定されていない場合は必ずfalse
  if (!userId) {
    return false;
  }

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
 * 出品者の評価スコアを取得
 */
export async function getSellerRating(userId: string): Promise<number> {
  const reviews = await prisma.auctionReview.findMany({
    where: {
      revieweeId: userId,
      isSellerReview: false, // 買い手から売り手への評価のみ
    },
  });

  if (reviews.length === 0) {
    return 0;
  }

  // 平均評価スコアを計算して返す
  const totalScore = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((totalScore / reviews.length) * 10) / 10; // 小数点第一位まで
}
