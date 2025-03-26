"use server";

import type { EventHistoryItem } from "../types";
import { AuctionEventType } from "../types";

// 遅延初期化用の変数
let connectionManagerInstance: any = null;

/**
 * ConnectionManagerを遅延ロードする
 * @returns ConnectionManagerインスタンス
 */
export async function getConnectionManagerInstance() {
  if (!connectionManagerInstance) {
    // 必要になった時点で動的にインポート
    const { getConnectionManager } = await import("@/app/api/auctions/[auctionId]/sse-server-sent-events/route");
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
  const connectionManager = await getConnectionManagerInstance();
  return connectionManager.broadcastToAuction(auctionId, type, data);
}

/**
 * 入札イベントを送信する
 * @param auctionId オークションID
 * @param bidData 入札データ
 * @param auctionData オークションデータ
 * @returns イベント
 */
export async function sendNewBidEvent(
  auctionId: string,
  bidData: {
    id: string;
    userId: string;
    amount: number;
    createdAt: string;
    user?: {
      id?: string;
      name?: string | null;
      image?: string | null;
    };
  },
  auctionData: {
    id: string;
    currentHighestBid: number;
    currentHighestBidderId: string | null;
    endTime: string;
  },
): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, {
    bid: bidData,
    auction: auctionData,
  });
}
