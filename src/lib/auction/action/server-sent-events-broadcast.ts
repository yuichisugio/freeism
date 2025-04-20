"use server";

import type { AuctionWithDetails, SSEAuctionEventType } from "../type/types";
import { connectionManager } from "../server-sent-events/connection-manager-singleton";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// route.tsファイルと同じEventHistoryItem型を定義
type EventHistoryItem = {
  id: number;
  type: SSEAuctionEventType;
  data: Record<string, unknown>;
  timestamp: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 特定のオークションの全接続に対してイベントを送信
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ
 * @returns イベント
 */
export async function sendEventToAuctionSubscribers(
  auctionId: string,
  type: SSEAuctionEventType,
  data: AuctionWithDetails,
): Promise<EventHistoryItem> {
  console.log("sendEventToAuctionSubscribers", auctionId, type);
  console.log(
    `server-sent-events-broadcast.ts_sendEventToAuctionSubscribers 処理開始 (Auction: ${auctionId}, Type: ${type}, CM Instance ID: ${connectionManager.getInstanceId()})`,
  );
  return connectionManager.broadcastToAuction(auctionId, type, data);
}
