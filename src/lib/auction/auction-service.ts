import type { Auction, BidHistory } from "@prisma/client";
import { getConnectionManager } from "@/app/api/auctions/[auctionId]/sse-server-sent-events/route";
import { prisma } from "@/lib/prisma";

import type { AuctionWithDetails, BidFormData, BidHistoryWithUser, Auction as CustomAuction, EventHistoryItem } from "./types";
import { DEFAULT_AUCTION_IMAGE_URL } from "./constants";
import { AuctionEventType } from "./types";

const connectionManager = getConnectionManager();

/**
 * 特定のオークションの全接続に対してイベントを送信
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ
 * @returns イベント
 */
export function sendEventToAuctionSubscribers(auctionId: string, type: AuctionEventType, data: Record<string, any>): EventHistoryItem {
  console.log("sendEventToAuctionSubscribers", auctionId, type, data);
  return connectionManager.broadcastToAuction(auctionId, type, data);
}

/**
 * オークション更新イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction オークション情報
 */
export function sendAuctionUpdateEvent(auctionId: string, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_UPDATE, { auction });
}

/**
 * 新規入札イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param bid 入札情報
 * @param auction 更新されたオークション情報
 */
export function sendNewBidEvent(auctionId: string, bid: Record<string, any>, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, { bid, auction });
}

/**
 * オークション延長イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param newEndTime 新しい終了時間
 * @param auction 更新されたオークション情報
 */
export function sendAuctionExtensionEvent(auctionId: string, newEndTime: string, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_EXTENSION, { newEndTime, auction });
}

/**
 * オークション終了イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction 最終的なオークション情報
 */
export function sendAuctionEndedEvent(auctionId: string, auction: Record<string, any>): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_ENDED, { auction });
}

/**
 * エラーイベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param error エラーメッセージ
 */
export function sendErrorEvent(auctionId: string, error: string): EventHistoryItem {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.ERROR, { error });
}

/**
 * Prismaモデルから@/types/auctionで定義されたAuction型に変換
 * @param auctionData Prismaモデルのオークションデータ
 * @returns @/types/auctionで定義されたAuction型のオークションデータ
 */
export function convertAuctionToAuctionType(auctionData: AuctionWithDetails): CustomAuction {
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
export function getAuctionStatus(auction: Auction | AuctionWithDetails): "upcoming" | "active" | "ended" {
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
 * @param userId ユーザーID
 * @param bidAmount 入札金額
 * @returns 入札可能かどうか
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
 * 入札を行う
 * @param auctionId オークションID
 * @param bidData {auctionId: string, amount: number, isAutoBid?: boolean, maxAmount?: number} 入札データ
 * @param userId ユーザーID
 * @returns 入札処理の結果
 */
export async function serverPlaceBid(auctionId: string, bidData: BidFormData, userId: string | undefined): Promise<{ success: boolean; message?: string; bid?: BidHistory }> {
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
            creator: true,
          },
        },
      },
    });

    if (!auction) {
      return { success: false, message: "オークションが見つかりません" };
    }

    // 入札可能か確認
    const auctionWithDetails: AuctionWithDetails = {
      ...auction,
      title: "",
      description: "",
      currentPrice: 0,
      sellerId: auction.task.creatorId,
      currentHighestBidder: null,
      winner: null,
      depositPeriod: auction.task.group.depositPeriod,
      bidHistories: [],
      options: {
        reconnectOnVisibility: true,
        bufferEvents: true,
        clientId: `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      },
    };

    // 入札可能か確認
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

    // メッセージを作成
    let message = undefined;
    if (canBidResult.message && bidData.isAutoBid) {
      message = canBidResult.message + "自動入札を設定しました";
    } else if (canBidResult.message) {
      message = canBidResult.message + "入札しました";
    } else if (bidData.isAutoBid) {
      message = "自動入札を設定しました";
    } else {
      message = "入札しました";
    }

    // 入札成功時のレスポンス
    return {
      success: true,
      bid: bid as BidHistory,
      message: message,
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
 * ウォッチリストの状態を切り替え
 * @param userId ユーザーID
 * @param auctionId オークションID
 * @returns ウォッチリストの状態
 */
export async function serverToggleWatchlist(userId: string | undefined, auctionId: string): Promise<boolean> {
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
 * @param userId ユーザーID
 * @param auctionId オークションID
 * @returns オークションがウォッチリストに追加されているかどうか
 */
export async function serverIsAuctionWatched(userId: string | undefined, auctionId: string): Promise<boolean> {
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
