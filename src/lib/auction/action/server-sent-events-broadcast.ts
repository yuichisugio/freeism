"use server";

import type { UpdateAuctionWithDetails } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントをRedis Pub/Subに発行する
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ (オークション詳細など)
 */
export async function sendEventToAuctionSubscribers(auctionId: string, data: UpdateAuctionWithDetails): Promise<void> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // バリデーション
  if (!auctionId || !data) throw new Error("auctionId and data are required");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションIDをキーにRedis Pub/Subチャンネルを作成
  const redisPubSubChannel = `auction:${auctionId}:events`;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // Pub/Subで送信するデータ構造 (SSEの data: 部分とは少し違う)
  const eventPayload = {
    data: data, // 送信するデータ本体
    timestamp: Date.now(),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // メッセージをJSON形式に変換
    const message = JSON.stringify(eventPayload);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // Redisクライアントキーを作成
    const redisClientKey = `auction:${auctionId}:events`;
    const channel = encodeURIComponent(redisClientKey);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // Redis REST APIのURLを作成
    const redisRestUrl = `${process.env.UPSTASH_REDIS_REST_URL}/publish/${channel}`;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // Redis REST APIにメッセージを送信
    await fetch(redisRestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        Accept: "text/event-stream",
      },
      body: message,
      cache: "no-cache",
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error(
      `src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_PubSub送信エラー: [PubSub] Failed to publish event to ${redisPubSubChannel}:`,
      error,
    );
    // エラーを呼び出し元に伝える
    throw error;
  }
}
