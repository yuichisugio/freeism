"use server";

import type { UpdateAuctionWithDetails } from "@/types/auction-types";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントをRedis Pub/Subに発行する
 * @param auctionId オークションID
 * @param data イベントデータ (オークション詳細など)
 * @throws Error バリデーションエラー、環境変数エラー、ネットワークエラー、HTTPエラーの場合
 */
export async function sendEventToAuctionSubscribers(
  auctionId: string,
  data: UpdateAuctionWithDetails,
): PromiseResult<null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 基本的なバリデーション
   */
  if (!auctionId || typeof auctionId !== "string") {
    throw new Error("auctionId must be a non-empty string");
  }

  if (!data || typeof data !== "object") {
    throw new Error("data must be a valid object");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 環境変数の存在確認
   */
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error("UPSTASH_REDIS_REST_URL environment variable is required");
  }

  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_TOKEN environment variable is required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * UpdateAuctionWithDetailsの必須フィールドをバリデーション
   */
  const requiredFields = [
    { field: "id", value: data.id },
    { field: "currentHighestBid", value: data.currentHighestBid },
    { field: "status", value: data.status },
    { field: "extensionTotalCount", value: data.extensionTotalCount },
    { field: "extensionLimitCount", value: data.extensionLimitCount },
    { field: "extensionTime", value: data.extensionTime },
    { field: "remainingTimeForExtension", value: data.remainingTimeForExtension },
    { field: "bidHistories", value: data.bidHistories },
  ];

  for (const { field, value } of requiredFields) {
    if (value === undefined || value === null) {
      throw new Error(`Required field '${field}' is missing or null in UpdateAuctionWithDetails`);
    }
  }

  // currentHighestBidが負の値でないことを確認
  if (data.currentHighestBid < 0) {
    throw new Error("currentHighestBid must be a non-negative number");
  }

  // bidHistoriesが配列であることを確認
  if (!Array.isArray(data.bidHistories)) {
    throw new Error("bidHistories must be an array");
  }

  // extensionTotalCountとextensionLimitCountが非負の整数であることを確認
  if (data.extensionTotalCount < 0 || !Number.isInteger(data.extensionTotalCount)) {
    throw new Error("extensionTotalCount must be a non-negative integer");
  }

  if (data.extensionLimitCount < 0 || !Number.isInteger(data.extensionLimitCount)) {
    throw new Error("extensionLimitCount must be a non-negative integer");
  }

  // extensionTimeとremainingTimeForExtensionが非負の数値であることを確認
  if (data.extensionTime < 0) {
    throw new Error("extensionTime must be a non-negative number");
  }

  if (data.remainingTimeForExtension < 0) {
    throw new Error("remainingTimeForExtension must be a non-negative number");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Pub/Subで送信するデータ構造 (SSEの data: 部分とは少し違う)
   */
  const eventPayload = {
    data: data, // 送信するデータ本体
    timestamp: Date.now(),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メッセージをJSON形式に変換
   */
  const message = JSON.stringify(eventPayload);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Redisクライアントキーを作成
   */
  const redisClientKey = `auction:${auctionId}:events`;
  const channel = encodeURIComponent(redisClientKey);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Redis REST APIのURLを作成
   */
  const redisRestUrl = `${process.env.UPSTASH_REDIS_REST_URL}/publish/${channel}`;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Redis REST APIにメッセージを送信
   */
  const response = await fetch(redisRestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      Accept: "text/event-stream",
    },
    body: message,
    cache: "no-cache",
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * HTTPエラーステータスをチェック
   */
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返す
   */
  return {
    success: true,
    message: "オークションイベントをRedis Pub/Subに発行しました",
    data: null,
  };
}
