"use server";

import type { AuctionEventType, AuctionWithDetails } from "../type/types";
import { connectionManager } from "../server-sent-events/connection-manager-singleton";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// route.tsファイルと同じEventHistoryItem型を定義
type EventHistoryItem = {
  id: number;
  type: AuctionEventType;
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
export async function sendEventToAuctionSubscribers(auctionId: string, type: AuctionEventType, data: AuctionWithDetails): Promise<EventHistoryItem> {
  console.log("sendEventToAuctionSubscribers", auctionId, type);
  return connectionManager.broadcastToAuction(auctionId, type, data);
}
