"use server";

import type { AuctionWithDetails, BidHistoryWithUser } from "../types";
import { AuctionEventType } from "../types";
import { sendEventToAuctionSubscribers } from "./connection";

// route.tsファイルと同じEventHistoryItem型を定義
type EventHistoryItem = {
  id: number;
  type: AuctionEventType;
  data: Record<string, any>;
  timestamp: number;
};

/**
 * オークション更新イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction オークション情報
 */
export async function sendAuctionUpdateEvent(auctionId: string, auction: AuctionWithDetails): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_UPDATE, auction);
}

/**
 * 新規入札イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param bid 入札情報
 * @param auction 更新されたオークション情報
 */
export async function sendNewBidEvent(auctionId: string, bid: BidHistoryWithUser, auction: AuctionWithDetails): Promise<EventHistoryItem> {
  const auctionWithBid: AuctionWithDetails = {
    ...auction,
    bid,
  };
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, auctionWithBid);
}

/**
 * オークション延長イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param newEndTime 新しい終了時間
 * @param auction 更新されたオークション情報
 */
export async function sendAuctionExtensionEvent(auctionId: string, newEndTime: string, auction: AuctionWithDetails): Promise<EventHistoryItem> {
  // 新しい終了時間を反映したオークションデータを作成
  const auctionWithNewEndTime: AuctionWithDetails = {
    ...auction,
    endTime: new Date(newEndTime),
  };
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_EXTENSION, auctionWithNewEndTime);
}

/**
 * オークション終了イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction 最終的なオークション情報
 */
export async function sendAuctionEndedEvent(auctionId: string, auction: AuctionWithDetails): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_ENDED, auction);
}

/**
 * エラーイベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param error エラーメッセージ
 */
export async function sendErrorEvent(auctionId: string, error: string): Promise<EventHistoryItem> {
  // エラーの場合は最小限のAuctionWithDetails型を作成
  const errorAuction: AuctionWithDetails = {
    id: auctionId,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "ERROR",
    taskId: "",
    startTime: new Date(),
    endTime: new Date(),
    currentHighestBid: 0,
    currentHighestBidderId: null,
    bidHistories: [],
    winnerId: null,
    extensionCount: 0,
    version: 0,
    title: "Error",
    description: error,
    currentPrice: 0,
    sellerId: "",
    task: {
      group: {},
      creator: {},
    } as any,
    depositPeriod: 0,
    currentHighestBidder: null,
    winner: null,
  };
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.ERROR, errorAuction);
}
