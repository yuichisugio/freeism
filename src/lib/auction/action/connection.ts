"use server";

import type { ConnectionManager } from "@/app/api/auctions/[auctionId]/sse-server-sent-events/route";

import type { BidHistoryWithUser, EventHistoryItem } from "../types";
import { AuctionEventType } from "../types";

// 遅延初期化用の変数
let connectionManagerInstance: ConnectionManager | null = null;

/**
 * ConnectionManagerを遅延ロードする
 * @returns ConnectionManagerインスタンス
 */
export async function getConnectionManagerInstance(): Promise<ConnectionManager> {
  if (!connectionManagerInstance) {
    console.log("action/connection: Loading ConnectionManager for the first time");
    // 必要になった時点で動的にインポート
    const { getConnectionManager } = await import("@/app/api/auctions/[auctionId]/sse-server-sent-events/route");
    connectionManagerInstance = getConnectionManager();
    console.log("action/connection: ConnectionManager instance loaded:", connectionManagerInstance ? "success" : "failed");
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
  const connectionManager = await getConnectionManagerInstance();
  return connectionManager.broadcastToAuction(auctionId, type, data as any);
}

/**
 * 入札イベントを送信する
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @param auctionData オークションデータ
 * @returns イベント
 */
export async function sendNewBidEvent(auctionId: string, bidData: BidHistoryWithUser, auctionData: Record<string, any>): Promise<EventHistoryItem> {
  const eventData: Record<string, any> = {
    ...auctionData,
    bid: bidData,
  };
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, eventData);
}
