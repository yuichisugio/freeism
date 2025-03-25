"use server";

import type { Auction, BidHistory } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import type { AuctionWithDetails, BidFormData, BidHistoryWithUser, Auction as CustomAuction, EventHistoryItem, User } from "./types";
import { DEFAULT_AUCTION_IMAGE_URL } from "./constants";
import { AuctionEventType } from "./types";

// 遅延初期化用の変数
let connectionManagerInstance: any = null;

/**
 * ConnectionManagerを遅延ロードする
 * @returns ConnectionManagerインスタンス
 */
function getConnectionManagerInstance() {
  if (!connectionManagerInstance) {
    // 必要になった時点で動的にインポート
    const { getConnectionManager } = require("@/app/api/auctions/[auctionId]/sse-server-sent-events/route");
    connectionManagerInstance = getConnectionManager();
  }
  return connectionManagerInstance;
}

/**
 * 特定のオークションの全接続に対してイベントを送信
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ
 * @returns イベント
 */
export async function sendEventToAuctionSubscribers(auctionId: string, type: AuctionEventType, data: Record<string, any>): Promise<EventHistoryItem> {
  console.log("sendEventToAuctionSubscribers", auctionId, type, data);
  const connectionManager = getConnectionManagerInstance();
  return connectionManager.broadcastToAuction(auctionId, type, data);
}

/**
 * オークション更新イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction オークション情報
 */
export async function sendAuctionUpdateEvent(auctionId: string, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_UPDATE, { auction });
}

/**
 * 新規入札イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param bid 入札情報
 * @param auction 更新されたオークション情報
 */
export async function sendNewBidEvent(auctionId: string, bid: Record<string, any>, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, { bid, auction });
}

/**
 * オークション延長イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param newEndTime 新しい終了時間
 * @param auction 更新されたオークション情報
 */
export async function sendAuctionExtensionEvent(auctionId: string, newEndTime: string, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_EXTENSION, { newEndTime, auction });
}

/**
 * オークション終了イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction 最終的なオークション情報
 */
export async function sendAuctionEndedEvent(auctionId: string, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_ENDED, { auction });
}

/**
 * エラーイベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param error エラーメッセージ
 */
export async function sendErrorEvent(auctionId: string, error: string): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.ERROR, { error });
}

/**
 * Prismaモデルから@/types/auctionで定義されたAuction型に変換
 * @param auctionData Prismaモデルのオークションデータ
 * @returns @/types/auctionで定義されたAuction型のオークションデータ
 */
export async function convertAuctionToAuctionType(auctionData: AuctionWithDetails): Promise<CustomAuction> {
  return {
    id: auctionData.id,
    title: auctionData.task.task,
    description: auctionData.task.detail || "",
    imageUrl: auctionData.task.imageUrl || DEFAULT_AUCTION_IMAGE_URL,
    currentPrice: auctionData.currentHighestBid,
    startTime: auctionData.startTime.toISOString(),
    endTime: auctionData.endTime.toISOString(),
    sellerId: auctionData.task.creatorId,
    seller: {
      id: auctionData.task.creator.id,
      username: auctionData.task.creator.name || "不明なユーザー",
      email: auctionData.task.creator.email,
      createdAt: auctionData.task.creator.createdAt.toISOString(),
      avatarUrl: auctionData.task.creator.image || undefined,
    },
    bidCount: auctionData.bidHistories?.length || 0,
    categories: [],
    watchCount: 0,
    depositPeriod: 7, // デフォルトの預かり期間を7日に設定
  };
}

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
          take: 10,
        },
      },
    });

    if (!auction) return null;

    // 必要なプロパティを持つオブジェクトとして返す
    return auction as unknown as AuctionWithDetails;
  } catch (error) {
    console.error("オークション取得エラー:", error);
    return null;
  }
}

/**
 * タスクIDに関連するオークション情報を取得
 * @param taskId タスクID
 * @returns オークション情報
 */
export async function getAuctionWithTask(taskId: string): Promise<AuctionWithDetails | null> {
  try {
    const auction = await prisma.auction.findUnique({
      where: { taskId },
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
          take: 10,
        },
      },
    });

    if (!auction) return null;

    // 必要なプロパティを持つオブジェクトとして返す
    return auction as unknown as AuctionWithDetails;
  } catch (error) {
    console.error("オークション取得エラー:", error);
    return null;
  }
}

/**
 * オークションの現在のステータスを取得
 * @param auction オークション情報
 * @returns オークションのステータス
 */
export async function getAuctionStatus(auction: Auction | AuctionWithDetails): Promise<"upcoming" | "active" | "ended"> {
  const now = new Date();

  if (now < new Date(auction.startTime)) {
    return "upcoming";
  } else if (now > new Date(auction.endTime)) {
    return "ended";
  } else {
    return "active";
  }
}

/**
 * 入札可能か確認する
 * @param auction オークション情報
 * @param bidAmount 入札金額
 * @returns 入札可能かどうか
 */
export async function canPlaceBid(auction: AuctionWithDetails, bidAmount: number): Promise<{ canBid: boolean; message?: string }> {
  // セッションからユーザー情報を取得
  const session = await auth();
  if (!session?.user?.id) {
    return { canBid: false, message: "認証が必要です" };
  }

  const userId = session.user.id;

  // オークションのステータスを確認
  const status = await getAuctionStatus(auction);

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

  // ユーザーのポイント残高を確認。ポイントが不足している場合でも入札可能だが、注意メッセージは表示する
  const userPointBalance = await getUserPointBalance(userId, auction.task.groupId);
  if (userPointBalance < bidAmount) {
    return {
      canBid: true,
      message: `ポイント残高が不足しています（残高: ${userPointBalance}ポイント）`,
    };
  }

  return { canBid: true };
}

/**
 * ユーザーのポイント残高を取得
 * @param userId ユーザーID
 * @param groupId グループID
 * @returns ユーザーのポイント残高
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
 * サーバーサイドでの入札処理
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @param userId ユーザーID
 * @returns 入札処理の結果
 */
export async function serverPlaceBid(auctionId: string, bidData: BidFormData, userId: string): Promise<{ success: boolean; message?: string; bid?: BidHistory }> {
  try {
    // オークション情報を取得
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { bidHistories: true },
    });

    if (!auction) {
      return { success: false, message: "オークションが見つかりません" };
    }

    // 終了したオークションには入札できない
    if (auction.endTime < new Date()) {
      return { success: false, message: "このオークションは既に終了しています" };
    }

    // 自分の出品したタスクには入札できない
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
    });

    if (task && task.creatorId === userId) {
      return { success: false, message: "自分の出品したタスクには入札できません" };
    }

    // 最低入札額のチェック
    const minimumBid = auction.currentHighestBid > 0 ? auction.currentHighestBid : 0;
    if (bidData.amount < minimumBid) {
      return {
        success: false,
        message: `最低入札額（${minimumBid}ポイント）以上で入札してください`,
      };
    }

    // 現在の最高入札額より高い額でなければならない
    if (auction.currentHighestBid >= bidData.amount) {
      return {
        success: false,
        message: `現在の最高入札額（${auction.currentHighestBid}ポイント）より高い額で入札してください`,
      };
    }

    // 入札履歴を作成
    const bidHistory = await prisma.bidHistory.create({
      data: {
        auctionId,
        userId,
        amount: bidData.amount,
        isAutoBid: bidData.isAutoBid || false,
      },
    });

    // オークションの現在の最高入札額と最高入札者を更新
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        currentHighestBid: bidData.amount,
        currentHighestBidderId: userId,
      },
    });

    // 入札成功
    return {
      success: true,
      message: "入札が完了しました",
      bid: bidHistory,
    };
  } catch (error) {
    console.error("入札処理エラー:", error);
    return { success: false, message: "入札処理中にエラーが発生しました" };
  }
}

/**
 * オークションの入札履歴を取得
 * @param auctionId オークションID
 * @param limit 取得する入札履歴の上限数
 * @returns 入札履歴
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

  return bids.map((bid) => ({
    ...bid,
    id: bid.id,
    auctionId: bid.auctionId,
    userId: bid.userId,
    amount: bid.amount,
    createdAt: bid.createdAt.toISOString(),
    isAutoBid: bid.isAutoBid,
    user: bid.user
      ? {
          id: bid.user.id,
          username: bid.user.name || "",
          email: bid.user.email,
          createdAt: bid.user.createdAt.toISOString(),
          avatarUrl: bid.user.image || undefined,
          name: bid.user.name,
          emailVerified: bid.user.emailVerified,
          image: bid.user.image,
          isAppOwner: bid.user.isAppOwner,
          updatedAt: bid.user.updatedAt,
        }
      : undefined,
  }));
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
 * 出品者の評価スコアを取得
 * @param userId ユーザーID
 * @returns 評価スコア
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
