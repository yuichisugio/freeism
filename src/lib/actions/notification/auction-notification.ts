"use server";

// プッシュ通知送信関数
import type { NotificationSendMethod, NotificationSendTiming, NotificationTargetType } from "@prisma/client";
import { sendPushNotification } from "@/lib/actions/notification/push-notification";
// prismaClient
import { prisma } from "@/lib/prisma";
import { AuctionEventType } from "@prisma/client";

import type { NotificationParams } from "./email-notification";
// メール通知送信関数
// import { sendMailNotification } from './mailNotification';
// アプリ内通知送信関数
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
 * オークション通知を送信する関数
 * @param {AuctionNotificationParams} params オークションイベントタイプ
 * @returns {success: boolean, error?: string} 通知処理の結果
 * GitHub Actionsで呼び出すため、auth()は使用しない
 */
export async function sendAuctionNotification(params: AuctionNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    if (params.recipientUserId?.length === 0) {
      console.error(`sendAuctionNotification_recipientUserId_エラー_stack:`, new Error().stack);
      console.error(`sendAuctionNotification_recipientUserId_エラー:`, "通知の対象者が見つかりません");
      throw new Error("通知の対象者が見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // オークションのイベントタイプごとのメッセージを作成
    let auctionNotificationTitle: string;
    let auctionNotificationMessage: string;
    try {
      // メッセージ作成に必要な情報をデータベースから取得
      // const { title, message } = await getAuctionNotificationMessage(params.auctionEventType, {
      // first:
      // second:
      // third:
      // fourth:
      // });
      // auctionNotificationTitle = title;
      // auctionNotificationMessage = message;
    } catch (error) {
      console.error(`sendAuctionNotification_getAuctionNotificationMessage_エラー:`, error);
      console.error(`sendAuctionNotification_getAuctionNotificationMessage_エラー_stack:`, new Error().stack);
      throw new Error("オークション通知のメッセージを作成できませんでした");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // 通知する内容を作成
    // const notificationParams: NotificationParams = {
    //   recipientUserIds: params.recipientUserId,
    //   title: auctionNotificationTitle,
    //   message: auctionNotificationMessage,
    //   actionUrl: params.actionUrl,
    //   targetType: NotificationTargetType.AUCTION_BIDDER,
    //   senderUserId: null,
    //   groupId: null,
    //   taskId: null,
    //   auctionId: null,
    //   sendTiming: params.sendTiming,
    //   sendScheduledDate: params.sendScheduledDate,
    //   expiresAt: params.expiresAt,
    // };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    // push通知を送信
    // sendPushNotification()

    // メール通知を送信
    // sendEmailNotification()

    // アプリ内通知を送信
    // sendAppNotification()

    //   return notifyNewBid(auctionId, bidId);
    // }

    // /**
    //  * オークション関連の通知を送信する
    //  * @param params - 通知送信に必要なパラメータ
    //  */
    // export const sendAuctionNotification = async (params: SendAuctionNotificationParams): Promise<void> => {
    //   const { eventType, recipientId, auctionId, relatedData = {}, methods } = params;

    //   try {
    //     const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    //     if (!recipient) {
    //       console.error(`Recipient user not found: ${recipientId}`);
    //       return;
    //     }

    //     let auctionData: (Auction & { task: Task }) | null = null;
    //     if (auctionId) {
    //       // auctionId を string として渡す
    //       auctionData = await prisma.auction.findUnique({
    //         where: { id: auctionId },
    //         include: { task: true },
    //       });
    //     }

    //     // 通知内容生成に必要なデータを統合
    //     const notificationData = {
    //       recipient,
    //       auction: auctionData,
    //       ...relatedData, // bid, question などの情報を含む
    //     };

    //     // 言語設定を取得 (ユーザー設定やデフォルト言語など)
    //     const lang = recipient.languagePreference ?? "ja"; // 仮の言語設定フィールド

    //     // 通知メッセージを取得
    //     const { title, body } = getAuctionNotificationMessage(eventType, notificationData, lang);

    //     // 通知データをDBに保存 (アプリ内通知用)
    //     if (methods.in_app_notification) {
    //       // auctionId が string であることを確認
    //       await sendInAppNotification({ recipientId, auctionId: auctionId, eventType, title, body });
    //     }

    //     // メール通知を送信
    //     if (methods.mail_notification && recipient.email) {
    //       // メール送信の条件チェック（ユーザー設定など）
    //       // if (recipient.notificationSettings?.email?.[eventType]) { // より詳細な設定がある場合
    //       await sendMailNotification({ to: recipient.email, subject: title, body });
    //       // }
    //     }

    //     // プッシュ通知を送信
    //     if (methods.push_notification) {
    //       // プッシュ通知送信の条件チェック（ユーザー設定、デバイストークン存在確認など）
    //       // if (recipient.notificationSettings?.push?.[eventType] && recipient.pushToken) {
    //       // auctionId が string であることを確認
    //       await sendPushNotification({ userId: recipientId, title, body, data: { auctionId: auctionId, eventType } });
    //       // }
    //     }
    //   } catch (error) {
    //     console.error(`Failed to send auction notification (${eventType}) for user ${recipientId}:`, error);
    //     // エラーハンドリング (ログ記録、リトライなど)
    //   }
    // };

    // // --- 各通知方法の送信関数 (スタブ) ---

    // const sendInAppNotification = async (data: {
    //   recipientId: string;
    //   auctionId?: string; // auctionId を Optional に変更
    //   eventType: AuctionEventType;
    //   title: string;
    //   body: string;
    // }) => {
    //   // Prismaを使って AuctionNotification テーブルにレコードを作成
    //   console.log("Sending In-App Notification:", data);
    //   // const expiryDate = calculateExpiryDate(data.eventType); // 自動削除日時を計算
    //   // await prisma.auctionNotification.create({ data: { ...data, expiresAt: expiryDate } });
    //   // TODO: 実際のDB保存処理を実装
    //   await prisma.auctionNotification.create({
    //     data: {
    //       userId: data.recipientId,
    //       auctionId: data.auctionId, // auctionId をそのまま渡す
    //       type: data.eventType,
    //       title: data.title,
    //       body: data.body,
    //       isRead: false,
    //       // expiresAt: calculateExpiryDate(data.eventType), // 自動削除日時を設定
    //     },
    //   });
    // };

    // const sendMailNotification = async (data: any) => {
    //   // メール送信ライブラリ (SendGrid, Nodemailerなど) を使用
    //   console.log("Sending Mail Notification:", data);
    //   // TODO: 実際のメール送信処理を実装
    // };

    // const sendPushNotification = async (data: any) => {
    //   // プッシュ通知サービス (FCM, APNSなど) を使用
    //   console.log("Sending Push Notification:", data);
    //   // TODO: 実際のプッシュ通知送信処理を実装
    // };

    // const calculateExpiryDate = (eventType: AuctionEventType): Date | null => {
    //   const now = new Date();
    //   switch (eventType) {
    //     case AuctionEventType.NEW_BID_ON_OWN_ITEM:
    //     case AuctionEventType.OUTBID:
    //     case AuctionEventType.QUESTION_RECEIVED:
    //       return null; // オークション終了時に削除するため、ここでは設定しない (別途削除処理を実装)
    //     case AuctionEventType.AUTO_BID_LIMIT_REACHED:
    //     case AuctionEventType.AUCTION_ENDED_OWN_ITEM:
    //     case AuctionEventType.AUCTION_WON:
    //     case AuctionEventType.AUCTION_LOST:
    //     case AuctionEventType.POINT_RETURNED:
    //       // 1ヶ月後に削除
    //       return new Date(now.setMonth(now.getMonth() + 1));
    //     default:
    //       return null;
    //   }
    // };

    return {
      success: true,
    };
  } catch (error) {
    console.error(`sendAuctionNotification_エラー:`, error);
    console.error(`sendAuctionNotification_エラー_stack:`, new Error().stack);
    return { success: false, error: "オークション通知の送信に失敗しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション関連の通知メッセージデータ
 */
type MessageData = {
  first: string;
  second?: string;
  third?: string;
  fourth?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションイベントタイプに応じた通知メッセージを取得する
 * @param eventType - オークションイベントタイプ
 * @param messageData - 通知内容生成に必要なデータ
 * @returns {title: string, body: string} 通知タイトルと本文のオブジェクト
 */
export async function getAuctionNotificationMessage(eventType: AuctionEventType, messageData: MessageData): Promise<{ title: string; body: string }> {
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
