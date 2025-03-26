"use server";

import { type AuctionEventType, type EventHistoryItem } from "../types";

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
