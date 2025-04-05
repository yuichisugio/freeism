"use server";

import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

enum AuctionEventType {
  ITEM_SOLD = "ITEM_SOLD",
  NO_WINNER = "NO_WINNER",
  ENDED = "ENDED",
  OUTBID = "OUTBID",
  QUESTION_RECEIVED = "QUESTION_RECEIVED",
  AUTO_BID_LIMIT_REACHED = "AUTO_BID_LIMIT_REACHED",
  AUCTION_WIN = "AUCTION_WIN",
  AUCTION_LOST = "AUCTION_LOST",
  POINT_RETURNED = "POINT_RETURNED",
}

type MessageData = {
  first: string;
  second?: string;
  third?: string;
  fourth?: string;
};

/**
 * オークションイベントタイプに応じた通知メッセージを取得する
 * @param eventType - オークションイベントタイプ
 * @param messageData - 通知内容生成に必要なデータ
 * @returns {title: string, body: string} 通知タイトルと本文のオブジェクト
 */
export function getAuctionNotificationMessage(eventType: AuctionEventType, messageData: MessageData): { title: string; body: string } {
  // イベントタイプごとに通知メッセージを生成
  switch (eventType) {
    // 入札：自分が入札した商品を落札できた時
    case AuctionEventType.AUCTION_WIN:
      return {
        title: `[${messageData.first}] を落札しました！`,
        body: `おめでとうございます！「${messageData.second}」を ${messageData.third ?? "最終"} ポイントで落札しました。`,
      };
    // 入札：自分の最高入札額だった商品の最高入札額が他者に更新された場合
    case AuctionEventType.OUTBID:
      return {
        title: `[${messageData.first}] の最高入札額が更新されました`,
        body: `他ユーザーが ${messageData.second} ポイントで最高入札額を更新したため、あなたは最高入札者ではなくなりました。`,
      };
    // 入札：入札に使用したポイントが返還された場合
    case AuctionEventType.POINT_RETURNED:
      return {
        title: `オークションポイントが返還されました`,
        body: `[${messageData.first}] のオークションで預けていたポイントが返還されました。`,
      };
    // 入札：入札した商品を落札できなかった場合
    case AuctionEventType.AUCTION_LOST:
      return {
        title: `[${messageData.first}] は落札できませんでした`,
        body: `あなたが入札していた「${messageData.second}」のオークションは他のユーザーが落札しました。`,
      };
    // 入札：自動入札の上限に達した場合
    case AuctionEventType.AUTO_BID_LIMIT_REACHED:
      return {
        title: `[${messageData.first}] の自動入札が上限に達しました`,
        body: `設定した自動入札の上限額に達したため、自動入札を停止しました。`,
      };
    // 出品：自分の出品した商品に新しい質問が届いた場合
    case AuctionEventType.QUESTION_RECEIVED:
      return {
        title: `[${messageData.first}] に新しい質問が届きました`,
        body: `「${messageData.second}」に新しい質問が届きました。`,
      };
    // 出品：自分の出品した商品のオークション期間が終了した場合
    case AuctionEventType.ENDED:
      return {
        title: `[${messageData.first}] のオークションが終了しました`,
        body: `出品した商品「${messageData.second}」のオークション期間が終了しました。結果を確認してください。`,
      };
    // 出品：自分の出品した商品の落札者が決まった場合
    case AuctionEventType.ITEM_SOLD:
      return {
        title: `[${messageData.first}] が落札されました`,
        body: `出品した商品「${messageData.second}」が ${messageData.third ?? "最終"} ポイントで落札されました。`,
      };
    // 出品：自分の出品した商品の落札者が決まらなかった場合
    case AuctionEventType.NO_WINNER:
      return {
        title: `[${messageData.first}] のオークションは落札者がいませんでした`,
        body: `「${messageData.second}」のオークションは落札者が現れませんでした。`,
      };
    default:
      throw new Error(`未対応のオークションイベントタイプです: ${String(eventType)}`);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション通知を送信する関数
 * @param auctionEventType オークションイベントタイプ
 * @param send 通知内容生成に必要なデータ
 * @returns 通知処理の結果
 */
export function sendAuctionNotification(auctionId: string, bidId: string): Promise<{ success: boolean }> {
  return notifyNewBid(auctionId, bidId);
}

/**
 * 新規入札通知を行う関数
 * @param auctionId オークションID
 * @param bidId 入札ID
 * @returns 通知処理の結果
 */
export async function notifyNewBid(auctionId: string, bidId: string): Promise<{ success: boolean }> {
  try {
    // 入札情報を取得
    const bid = await prisma.bidHistory.findUnique({
      where: { id: bidId },
      include: { user: true },
    });

    if (!bid) {
      console.error(`入札情報が見つかりません ID: ${bidId}`);
      return { success: false };
    }

    // オークション情報を取得
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        task: {
          include: {
            creator: true,
            group: true,
          },
        },
        bidHistories: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!auction) {
      console.error(`オークション情報が見つかりません ID: ${auctionId}`);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error("入札通知処理エラー:", error);
    return { success: false };
  }
}
