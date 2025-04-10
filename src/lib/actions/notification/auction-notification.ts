"use server";

import type { NotificationSendTiming } from "@prisma/client";
import { sendPushNotification } from "@/lib/actions/notification/push-notification";
import { AuctionEventType, NotificationSendMethod, NotificationTargetType } from "@prisma/client";

import type { NotificationParams } from "./email-notification";
import { sendEmailNotification } from "./email-notification";
import { sendInAppNotification } from "./in-app-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション関連の通知の管理を行うファイル
 */

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション関連の通知メッセージデータ
 */
export type AuctionNotificationParams = {
  text: MessageData;
  auctionEventType: AuctionEventType;
  auctionId: string;
  recipientUserId: string[];
  sendMethod: NotificationSendMethod[];
  actionUrl: string | null;
  sendTiming: NotificationSendTiming;
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション関連の通知メッセージデータ
 */
type MessageData = {
  first: string;
  second: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション通知を送信する関数
 * @param {AuctionNotificationParams} params 通知メッセージデータ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendAuctionNotification(params: AuctionNotificationParams): Promise<{ success: boolean; error?: string }> {
  // Server Actions としてマーク
  "use server";

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (params.recipientUserId?.length === 0) {
      console.error(`sendAuctionNotification_recipientUserId_エラー_stack:`, new Error().stack);
      console.error(`sendAuctionNotification_recipientUserId_エラー:`, "通知の対象者が見つかりません");
      throw new Error("通知の対象者が見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // メッセージ作成に必要な情報をデータベースから取得
    const { title, body, targetType } = await getAuctionNotificationMessage(params.auctionEventType, params.text);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 自動で削除する日付を計算
    const expiryDate = await calculateExpiryDate(params.auctionEventType);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知する内容を作成
    const notificationParams: NotificationParams = {
      recipientUserIds: params.recipientUserId,
      title: title,
      message: body,
      actionUrl: params.actionUrl,
      targetType: targetType,
      senderUserId: null,
      groupId: null,
      taskId: null,
      auctionId: params.auctionId,
      sendTiming: params.sendTiming,
      sendScheduledDate: params.sendScheduledDate,
      expiresAt: expiryDate,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // push通知を送信
    if (params.sendMethod.includes(NotificationSendMethod.WEB_PUSH) && params.sendTiming === "NOW") {
      const pushNotificationResult = await sendPushNotification(notificationParams);
      if (!pushNotificationResult.success) {
        console.error("sendAuctionNotification_sendPushNotification_エラー:");
        console.error("sendAuctionNotification_sendPushNotification_エラー_stack:", new Error().stack);
        return { success: false, error: "プッシュ通知の送信に失敗しました" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // メール通知を送信
    if (params.sendMethod.includes(NotificationSendMethod.EMAIL) && params.sendTiming === "NOW") {
      const emailNotificationResult = await sendEmailNotification(notificationParams);
      if (!emailNotificationResult.success) {
        console.error("sendAuctionNotification_sendEmailNotification_エラー:");
        console.error("sendAuctionNotification_sendEmailNotification_エラー_stack:", new Error().stack);
        return { success: false, error: "メール通知の送信に失敗しました" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // アプリ内通知を送信
    if (params.sendMethod.includes(NotificationSendMethod.IN_APP)) {
      const inAppNotificationResult = await sendInAppNotification(notificationParams);
      if (!inAppNotificationResult.success) {
        console.error("sendAuctionNotification_sendInAppNotification_エラー:");
        console.error("sendAuctionNotification_sendInAppNotification_エラー_stack:", new Error().stack);
        return { success: false, error: "アプリ内通知の送信に失敗しました" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error(`sendAuctionNotification_エラー:`, error);
    console.error(`sendAuctionNotification_エラー_stack:`, new Error().stack);
    return { success: false, error: "オークション通知の送信に失敗しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントタイプに応じた自動で削除する日時を計算する。
 * 一旦全てのオークション通知は通知の1ヶ月後に削除する。
 * 今後は、イベントタイプに応じた自動で削除する日時を計算する。
 * @param eventType - オークションイベントタイプ
 * @returns {Date | null} 自動削除日時
 */
export async function calculateExpiryDate(eventType: AuctionEventType): Promise<Date | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 現在の日時を取得
  const now = new Date();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // イベントタイプに応じた自動で削除する日時を計算
  switch (eventType) {
    case AuctionEventType.ITEM_SOLD:
    case AuctionEventType.NO_WINNER:
    case AuctionEventType.ENDED:
    case AuctionEventType.OUTBID:
    case AuctionEventType.QUESTION_RECEIVED:
    case AuctionEventType.AUTO_BID_LIMIT_REACHED:
    case AuctionEventType.AUCTION_WIN:
    case AuctionEventType.AUCTION_LOST:
    case AuctionEventType.POINT_RETURNED:
    case AuctionEventType.AUCTION_CANCELED:
    default:
      return new Date(now.setMonth(now.getMonth() + 1));
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントタイプに応じた通知メッセージを取得する
 * @param eventType - オークションイベントタイプ
 * @param messageData - 通知内容生成に必要なデータ
 * @returns {title: string, body: string, targetType: NotificationTargetType} 通知タイトルと本文のオブジェクト
 */
export async function getAuctionNotificationMessage(eventType: AuctionEventType, messageData: MessageData): Promise<{ title: string; body: string; targetType: NotificationTargetType }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // イベントタイプごとに通知メッセージを生成
    switch (eventType) {
      // 入札：自分が入札した商品を落札できた時
      case AuctionEventType.AUCTION_WIN:
        return {
          title: `[${messageData.first}] を落札しました！`,
          body: `おめでとうございます！「${messageData.second}」を落札しました。`,
          targetType: NotificationTargetType.AUCTION_BIDDER,
        };
      // 入札：自分の最高入札額だった商品の最高入札額が他者に更新された場合
      case AuctionEventType.OUTBID:
        return {
          title: `[${messageData.first}] の最高入札額が更新されました`,
          body: `他ユーザーが ${messageData.second} ポイントで最高入札額を更新したため、あなたは最高入札者ではなくなりました。`,
          targetType: NotificationTargetType.AUCTION_BIDDER,
        };
      // 入札：入札に使用したポイントが返還された場合
      case AuctionEventType.POINT_RETURNED:
        return {
          title: `オークションポイントが返還されました`,
          body: `[${messageData.first}] のオークションで預けていたポイント${messageData.second}ptが返還されました。`,
          targetType: NotificationTargetType.AUCTION_BIDDER,
        };
      // 入札：入札した商品を落札できなかった場合
      case AuctionEventType.AUCTION_LOST:
        return {
          title: `[${messageData.first}] は落札できませんでした`,
          body: `あなたが入札していた「${messageData.second}」のオークションは他のユーザーが落札しました。`,
          targetType: NotificationTargetType.AUCTION_BIDDER,
        };
      // 入札：自動入札の上限に達した場合
      case AuctionEventType.AUTO_BID_LIMIT_REACHED:
        return {
          title: `[${messageData.first}] の自動入札が上限に達しました`,
          body: `設定した自動入札の上限額(${messageData.second}pt)に達したため、自動入札を停止しました。`,
          targetType: NotificationTargetType.AUCTION_BIDDER,
        };
      // 出品：自分の出品した商品に新しい質問が届いた場合
      case AuctionEventType.QUESTION_RECEIVED:
        return {
          title: `[${messageData.first}] に新しい質問が届きました`,
          body: `「${messageData.second}」に新しい質問が届きました。`,
          targetType: NotificationTargetType.AUCTION_SELLER,
        };
      // 出品：自分の出品した商品のオークション期間が終了した場合
      case AuctionEventType.ENDED:
        return {
          title: `[${messageData.first}] のオークションが終了しました`,
          body: `出品した商品「${messageData.second}」のオークション期間が終了しました。結果を確認してください。`,
          targetType: NotificationTargetType.AUCTION_SELLER,
        };
      // 出品：自分の出品した商品の落札者が決まった場合
      case AuctionEventType.ITEM_SOLD:
        return {
          title: `[${messageData.first}] が落札されました`,
          body: `出品した商品「${messageData.second}」が落札されました。`,
          targetType: NotificationTargetType.AUCTION_SELLER,
        };
      // 出品：自分の出品した商品の落札者が決まらなかった場合
      case AuctionEventType.NO_WINNER:
        return {
          title: `[${messageData.first}] のオークションは落札者がいませんでした`,
          body: `「${messageData.second}」のオークションは落札者が現れませんでした。`,
          targetType: NotificationTargetType.AUCTION_SELLER,
        };
      default:
        throw new Error(`未対応のオークションイベントタイプです: ${String(eventType)}`);
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error(`getAuctionNotificationMessage_エラー:`, error);
    console.error(`getAuctionNotificationMessage_エラー_stack:`, new Error().stack);
    throw new Error("オークション通知のメッセージを作成できませんでした");
  }
}
