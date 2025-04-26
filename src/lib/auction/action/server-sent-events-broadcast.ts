"use server";

import type { AuctionWithDetails } from "../type/types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントをRedis Pub/Subに発行する
 * @param auctionId オークションID
 * @param type イベントタイプ
 * @param data イベントデータ (オークション詳細など)
 */
export async function sendEventToAuctionSubscribers(auctionId: string, data: AuctionWithDetails): Promise<void> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log(
    `src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_start: auctionId=${auctionId}, data=${JSON.stringify(data)}`,
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // オークションIDをキーにRedis Pub/Subチャンネルを作成
  const redisPubSubChannel = `auction:${auctionId}:events`;
  console.log(`src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_redisPubSubChannel: ${redisPubSubChannel}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // Pub/Subで送信するデータ構造 (SSEの data: 部分とは少し違う)
  const eventPayload = {
    data: data, // 送信するデータ本体
    timestamp: Date.now(),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // メッセージをJSON形式に変換
    const message = JSON.stringify(eventPayload);
    console.log(`src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_PubSub送信メッセージ: ${message}`);

    // Redisクライアントキーを作成
    const redisClientKey = `auction:${auctionId}:events`;
    const channel = encodeURIComponent(redisClientKey);

    // Redis REST APIのURLを作成
    const redisRestUrl = `${process.env.UPSTASH_REDIS_REST_URL}/publish/${channel}`;
    console.log(`src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_redisRestUrl: ${redisRestUrl}`);

    // Redis REST APIにメッセージを送信
    const upstream = await fetch(redisRestUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        Accept: "text/event-stream",
      },
      body: message,
      cache: "no-cache",
    });
    console.log(
      `src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_PubSub送信: [PubSub] Published event to ${redisPubSubChannel}. Subscribers: ${upstream.status}`,
    );

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error(
      `src/lib/auction/action/server-sent-events-broadcast.ts_sendEventToAuctionSubscribers_PubSub送信エラー: [PubSub] Failed to publish event to ${redisPubSubChannel}:`,
      error,
    );
    // エラーを呼び出し元に伝える
    throw error;
  }
}
