"use server";

import { redis } from "@/lib/redis";

import type { AuctionWithDetails, SSEAuctionEventType } from "../type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントをRedis Pub/Subに発行する
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ (オークション詳細など)
 */
export async function sendEventToAuctionSubscribers(auctionId: string, type: SSEAuctionEventType, data: AuctionWithDetails): Promise<void> {
  // 戻り値は void または 発行したイベントID など

  const redisPubSubChannel = `auction:${auctionId}:events`;

  // Pub/Subで送信するデータ構造 (SSEの data: 部分とは少し違う)
  const eventPayload = {
    type: type, // イベントタイプ ('new_bid', 'auction_update'など)
    data: data, // 送信するデータ本体
    timestamp: Date.now(),
  };

  try {
    const message = JSON.stringify(eventPayload);
    const publishResult = await redis.publish(redisPubSubChannel, message);
    console.log(`[PubSub] Published event (${type}) to ${redisPubSubChannel}. Subscribers: ${publishResult}`);
  } catch (error) {
    console.error(`[PubSub] Failed to publish event to ${redisPubSubChannel}:`, error);
    // 必要に応じてエラーハンドリングやリトライ処理
    throw error; // エラーを呼び出し元に伝える
  }
}
