"use server";

import type { EventHistoryItem } from "../types";
import { AuctionEventType } from "../types";
import { sendEventToAuctionSubscribers } from "./connection";

/**
 * オークション更新イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction オークション情報
 */
export async function sendAuctionUpdateEvent(auctionId: string, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_UPDATE, { auction });
}

/**
 * 新規入札イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param bid 入札情報
 * @param auction 更新されたオークション情報
 */
export async function sendNewBidEvent(auctionId: string, bid: Record<string, any>, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.NEW_BID, { bid, auction });
}

/**
 * オークション延長イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param newEndTime 新しい終了時間
 * @param auction 更新されたオークション情報
 */
export async function sendAuctionExtensionEvent(auctionId: string, newEndTime: string, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_EXTENSION, { newEndTime, auction });
}

/**
 * オークション終了イベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param auction 最終的なオークション情報
 */
export async function sendAuctionEndedEvent(auctionId: string, auction: Record<string, any>): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.AUCTION_ENDED, { auction });
}

/**
 * エラーイベントの送信ヘルパー関数
 * @param auctionId オークションID
 * @param error エラーメッセージ
 */
export async function sendErrorEvent(auctionId: string, error: string): Promise<EventHistoryItem> {
  return sendEventToAuctionSubscribers(auctionId, AuctionEventType.ERROR, { error });
}
