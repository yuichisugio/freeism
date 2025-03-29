"use server";

import type { AuctionWithDetails, BidHistoryWithUser } from "../types";
import { connectionManager } from "../server-sent-events/connection-manager-singleton";
import { AuctionEventType } from "../types";

// route.tsファイルと同じEventHistoryItem型を定義
type EventHistoryItem = {
  id: number;
  type: AuctionEventType;
  data: Record<string, any>;
  timestamp: number;
};

/**
 * 特定のオークションの全接続に対してイベントを送信
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ
 * @returns イベント
 */
export async function sendEventToAuctionSubscribers(auctionId: string, type: AuctionEventType, data: AuctionWithDetails): Promise<EventHistoryItem> {
  console.log("sendEventToAuctionSubscribers", auctionId, type);
  return connectionManager.broadcastToAuction(auctionId, type, data);
}

/**
 * 入札イベントを送信する
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @param auctionData オークションデータ
 * @returns イベント
 */
export async function sendNewBidEvent(auctionId: string, bidData: BidHistoryWithUser, auctionData: AuctionWithDetails): Promise<EventHistoryItem> {
  const eventData: AuctionWithDetails = {
    ...auctionData,
    bid: bidData,
  };
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, eventData);
}
