"use server";

import { sendPushNotification } from "@/actions/notification/push-notification";
import {
  AuctionEventType,
  NotificationSendMethod,
  NotificationSendTiming,
  NotificationTargetType,
} from "@prisma/client";

import type { NotificationParams } from "./email-notification";
import { sendEmailNotification } from "./email-notification";
import { sendInAppNotification } from "./in-app-notification";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション関連の通知メッセージデータ
 */
export type AuctionNotificationParams = {
  text: MessageData;
  auctionEventType: AuctionEventType;
  auctionId: string;
  recipientUserId: string[];
  sendMethods: NotificationSendMethod[];
  actionUrl: string | null;
  sendTiming: NotificationSendTiming;
  sendScheduledDate: Date | null;
  expiresAt: Date | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション関連の通知メッセージデータ
 */
export type MessageData = {
  first: string;
  second: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション通知を送信する関数
 * @param {AuctionNotificationParams} params 通知メッセージデータ
 * @returns {success: boolean, error?: string} 成功したかどうか
 */
export async function sendAuctionNotification(
  params: AuctionNotificationParams,
): Promise<{ success: boolean; message: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 必要なデータが不足している場合はエラーを返す
     * オークション通知は、予約送信に対応していないため、送信タイミングがNOWでない場合はエラーを返す
     */
    if (
      !params.text?.first ||
      !params.text.second ||
      !params.auctionEventType ||
      !Object.values(AuctionEventType).includes(params.auctionEventType) ||
      !params.auctionId ||
      !params.recipientUserId ||
      params.recipientUserId.length === 0 ||
      !params.sendMethods ||
      params.sendMethods.length === 0 ||
      !params.sendMethods.every((method) => Object.values(NotificationSendMethod).includes(method)) ||
      params.sendTiming !== NotificationSendTiming.NOW
    ) {
      throw new Error("必要なデータが不足しています");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メッセージ作成に必要な情報をデータベースから取得
     */
    const { title, body, targetType } = await getAuctionNotificationMessage(params.auctionEventType, params.text);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ステータスごとの自動で削除する日付を計算
     * 現在は、全てのオークション通知は通知の1ヶ月後に削除する。
     * 今後は、イベントタイプに応じた自動で削除する日時を計算する。
     */
    // 自動で削除する日付を計算
    let expiryDate: Date;

    // イベントタイプに応じた自動で削除する日時を計算
    switch (params.auctionEventType) {
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
        expiryDate = new Date(new Date().setMonth(new Date().getMonth() + 1));
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 通知する内容を作成
     */
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
      sendMethods: params.sendMethods,
      notificationId: null,
      sentAt: null,
    };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * push通知を送信
     */
    if (notificationParams.sendMethods.includes(NotificationSendMethod.WEB_PUSH)) {
      const pushNotificationResult = await sendPushNotification(notificationParams);
      if (!pushNotificationResult.success) {
        throw new Error("プッシュ通知の送信に失敗しました");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メール通知を送信
     */
    if (notificationParams.sendMethods.includes(NotificationSendMethod.EMAIL)) {
      const emailNotificationResult = await sendEmailNotification(notificationParams);
      if (!emailNotificationResult.success) {
        throw new Error("メール通知の送信に失敗しました");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * アプリ内通知を送信
     */
    if (notificationParams.sendMethods.includes(NotificationSendMethod.IN_APP)) {
      const inAppNotificationResult = await sendInAppNotification(notificationParams);
      if (!inAppNotificationResult.success) {
        throw new Error("アプリ内通知の送信に失敗しました");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功した場合は成功を返す
     */
    return { success: true, message: "オークション通知の送信に成功しました" };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーが発生した場合はエラーを返す
     */
  } catch (error) {
    console.error(`sendAuctionNotification_エラー:`, error);
    console.error(`sendAuctionNotification_エラー_stack:`, new Error().stack);
    return {
      success: false,
      message: `オークション通知の送信に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントタイプに応じた通知メッセージを取得する
 * @param eventType - オークションイベントタイプ
 * @param messageData - 通知内容生成に必要なデータ
 * @returns {title: string, body: string, targetType: NotificationTargetType} 通知タイトルと本文のオブジェクト
 */
export async function getAuctionNotificationMessage(
  eventType: AuctionEventType,
  messageData: MessageData,
): Promise<{ title: string; body: string; targetType: NotificationTargetType }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * イベントタイプの検証
   */
  if (!Object.values(AuctionEventType).includes(eventType) || !messageData?.first || !messageData.second) {
    throw new Error(`Invalid event type: ${eventType} or messageData: ${JSON.stringify(messageData)}`);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * イベントタイプごとに通知メッセージを生成
   */
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
}
