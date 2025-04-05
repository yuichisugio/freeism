# オークション通知機能 仕様書

## 1. 概要

- 本仕様書は、オークション機能における通知システムの設計と動作を定義する。
- ユーザーは、オークションに関連する重要なイベント（入札、落札、質問など）に関する通知を受け取ることができる。
- 通知は、アプリ内通知、メール通知、プッシュ通知の形式で送信される。

## 2. 設計方針

- **開発ルール**

  - Step by Stepで、以下の内容の実装計画と実装を行なってください。
  - できる限りサーバーの負荷をかけず、サーバーのアクセス回数も減らす設計
    - 現状では、可能な限りStateで管理
  - 型の情報は、全て「lib/auction/type」ファイルにまとめて下さい。
  - `||`を使用せず、`??`を使用して下さい。

- **UIとロジックを完全に分離**

  - クライアントコンポーネントの場合は、カスタムフックにロジックをまとめる。など
  - 画面やModalを非表示にする際のみ、DBに保存する。など

- **保守性・可読性の向上:**
  - 通知の種類を `AuctionEventType` として明確に定義し、イベントタイプに基づいて通知内容を決定する。
  - 通知メッセージの取得ロジックを `getAuctionNotificationMessage` 関数に分離する。
  - 通知送信処理を `sendAuctionNotification` 関数に集約し、内部で各通知方法（アプリ内、メール、プッシュ）の送信関数を呼び出す。
  - ページネーションを実装
- **柔軟性:**
  - `sendAuctionNotification` 関数の引数で、通知を送信する方法（アプリ内、メール、プッシュ）を選択できるようにする。
- **データベース:**
  - 通知データは `AuctionNotification` テーブルに保存する。
- **その他**
  - 「通知から１ヶ月後に自動削除」トリガーの実装
    - GitHub Actionsを使用して、リポジトリ内のコードを定期的に実行する方法で、通知を確認して、通知から1ヶ月経っている場合は、通知のデータをDBから削除する
    - 定期的な実行処理は、1週間に一回で、日本時間の深夜1時ごろに行うようにする。
  - 通知の削除機能
  - ページネーション機能
  - 入札に伴い、関係するユーザーへ通知を行う機能

## 3. 通知イベントタイプ (`AuctionEventType`)

オークションで発生する通知トリガーとなるイベントタイプを定義する。

- 通知を行う条件
  1. (不要)自分が出品した商品に、他者が入札した場合
     - この通知は、その商品のオークション終了後に自動で削除する
  2. 自分が入札した商品に、別の人が入札して追い越された場合
     - この通知は、その商品のオークション終了後に自動で削除する
  3. 自分が出品した商品に、質問が来た場合
     - この通知は、その商品のオークション終了後に自動で削除する
  4. 設定した上限金額に達した場合。
     - 通知から１ヶ月後に自動削除。
  5. 自分が出品した商品の、オークション期間が終了した場合
     - 通知から１ヶ月後に自動削除。
  6. 落札者（最高入札者）および出品者に対して、オークション終了時に結果（落札者と落札額）を通知する。
     - 通知から１ヶ月後に自動削除。
  7. `balance`カラムのポイントが返還された時
     - 通知から１ヶ月後に自動削除。
  8. オークション終了時に、落札できなかった場合、その旨を通知
     - 通知から１ヶ月後に自動削除。

```typescript
// lib/auction/type/notification.ts
export const AuctionEventType = {
  NEW_BID_ON_OWN_ITEM: "NEW_BID_ON_OWN_ITEM", // 自身が出品した商品への新規入札
  OUTBID: "OUTBID", // 自身が入札した商品で最高額を更新された
  QUESTION_RECEIVED: "QUESTION_RECEIVED", // 自身が出品した商品への質問受信
  AUTO_BID_LIMIT_REACHED: "AUTO_BID_LIMIT_REACHED", // 自動入札の上限到達
  AUCTION_ENDED_OWN_ITEM: "AUCTION_ENDED_OWN_ITEM", // 自身が出品したオークションの終了
  AUCTION_WON: "AUCTION_WON", // オークション落札
  AUCTION_LOST: "AUCTION_LOST", // オークション落札失敗
  POINT_RETURNED: "POINT_RETURNED", // ポイント返還完了
  // 必要に応じて他のイベントタイプを追加
} as const;

export type AuctionEventType = (typeof AuctionEventType)[keyof typeof AuctionEventType];
```

## 関数

- イベントタイプに応じた、通知メッセージを返す関数
  - getAuctionNotificationMessage

## 5. 通知送信方法指定オブジェクト (NotificationMethodType)どの方法で通知を送信するかを指定するオブジェクトの型。

```typescript
// lib/auction/type/notification.ts
export interface NotificationMethodType {
  in_app_notification: boolean; // アプリ内通知
  mail_notification: boolean; // メール通知
  push_notification: boolean; // プッシュ通知
}
```

## 6. 通知送信関数 (sendAuctionNotification)オークション関連の通知を一元的に送信する関数。

```typescript
// server/auction/notificationService.ts
// 正しいパスに修正
import { getAuctionNotificationMessage } from "@/lib/auction/notificationUtils"; // 正しいパスに修正
import { AuctionEventType, NotificationMethodType } from "@/lib/auction/type/notification"; // 正しいパスに修正
import { Auction, BidHistory, PrismaClient, Task, User } from "@prisma/client"; // Task を追加

// プッシュ通知送信関数 (別途実装)
import { sendPushNotification } from './pushNotification';
// メール通知送信関数 (別途実装)
import { sendMailNotification } from './mailNotification';
// アプリ内通知送信関数 (別途実装)
import { sendInAppNotification } from './inAppNotification';

const prisma = new PrismaClient();

interface SendAuctionNotificationParams {
  eventType: AuctionEventType;
  recipientId: string; // 通知受信者のユーザーID
  auctionId?: string; // 関連するオークションID
  relatedData?: any; // 通知内容生成に必要な追加データ (入札情報、質問情報など)
  methods: NotificationMethodType; // 送信方法
}

/**
 * オークション関連の通知を送信する
 * @param params - 通知送信に必要なパラメータ
 */
export const sendAuctionNotification = async (params: SendAuctionNotificationParams): Promise<void> => {
  const { eventType, recipientId, auctionId, relatedData = {}, methods } = params;

  try {
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      console.error(`Recipient user not found: ${recipientId}`);
      return;
    }

    let auctionData: (Auction & { task: Task }) | null = null;
    if (auctionId) {
      // auctionId を string として渡す
      auctionData = await prisma.auction.findUnique({
        where: { id: auctionId },
        include: { task: true },
      });
    }

    // 通知内容生成に必要なデータを統合
    const notificationData = {
      recipient,
      auction: auctionData,
      ...relatedData, // bid, question などの情報を含む
    };

    // 言語設定を取得 (ユーザー設定やデフォルト言語など)
    const lang = recipient.languagePreference ?? "ja"; // 仮の言語設定フィールド

    // 通知メッセージを取得
    const { title, body } = getAuctionNotificationMessage(eventType, notificationData, lang);

    // 通知データをDBに保存 (アプリ内通知用)
    if (methods.in_app_notification) {
      // auctionId が string であることを確認
      await sendInAppNotification({ recipientId, auctionId: auctionId, eventType, title, body });
    }

    // メール通知を送信
    if (methods.mail_notification && recipient.email) {
      // メール送信の条件チェック（ユーザー設定など）
      // if (recipient.notificationSettings?.email?.[eventType]) { // より詳細な設定がある場合
      await sendMailNotification({ to: recipient.email, subject: title, body });
      // }
    }

    // プッシュ通知を送信
    if (methods.push_notification) {
      // プッシュ通知送信の条件チェック（ユーザー設定、デバイストークン存在確認など）
      // if (recipient.notificationSettings?.push?.[eventType] && recipient.pushToken) {
      // auctionId が string であることを確認
      await sendPushNotification({ userId: recipientId, title, body, data: { auctionId: auctionId, eventType } });
      // }
    }
  } catch (error) {
    console.error(`Failed to send auction notification (${eventType}) for user ${recipientId}:`, error);
    // エラーハンドリング (ログ記録、リトライなど)
  }
};

// --- 各通知方法の送信関数 (スタブ) ---

const sendInAppNotification = async (data: {
  recipientId: string;
  auctionId?: string; // auctionId を Optional に変更
  eventType: AuctionEventType;
  title: string;
  body: string;
}) => {
  // Prismaを使って AuctionNotification テーブルにレコードを作成
  console.log("Sending In-App Notification:", data);
  // const expiryDate = calculateExpiryDate(data.eventType); // 自動削除日時を計算
  // await prisma.auctionNotification.create({ data: { ...data, expiresAt: expiryDate } });
  // TODO: 実際のDB保存処理を実装
  await prisma.auctionNotification.create({
    data: {
      userId: data.recipientId,
      auctionId: data.auctionId, // auctionId をそのまま渡す
      type: data.eventType,
      title: data.title,
      body: data.body,
      isRead: false,
      // expiresAt: calculateExpiryDate(data.eventType), // 自動削除日時を設定
    },
  });
};

const sendMailNotification = async (data: any) => {
  // メール送信ライブラリ (SendGrid, Nodemailerなど) を使用
  console.log("Sending Mail Notification:", data);
  // TODO: 実際のメール送信処理を実装
};

const sendPushNotification = async (data: any) => {
  // プッシュ通知サービス (FCM, APNSなど) を使用
  console.log("Sending Push Notification:", data);
  // TODO: 実際のプッシュ通知送信処理を実装
};

const calculateExpiryDate = (eventType: AuctionEventType): Date | null => {
  const now = new Date();
  switch (eventType) {
    case AuctionEventType.NEW_BID_ON_OWN_ITEM:
    case AuctionEventType.OUTBID:
    case AuctionEventType.QUESTION_RECEIVED:
      return null; // オークション終了時に削除するため、ここでは設定しない (別途削除処理を実装)
    case AuctionEventType.AUTO_BID_LIMIT_REACHED:
    case AuctionEventType.AUCTION_ENDED_OWN_ITEM:
    case AuctionEventType.AUCTION_WON:
    case AuctionEventType.AUCTION_LOST:
    case AuctionEventType.POINT_RETURNED:
      // 1ヶ月後に削除
      return new Date(now.setMonth(now.getMonth() + 1));
    default:
      return null;
  }
};
```

## 7. 通知トリガー条件と送信内容

| 条件                                           | イベントタイプ (`AuctionEventType`) | 受信者     | デフォルト送信方法                               | メッセージ内容 (例)                                                                                                                      | 自動削除タイミング  |
| :--------------------------------------------- | :---------------------------------- | :--------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- | :------------------ |
| 自分が出品した商品に他者が入札した場合         | `NEW_BID_ON_OWN_ITEM`               | 出品者     | アプリ内, (メール, プッシュ: ユーザー設定による) | 「[商品名] に新しい入札がありました」<br/>「[入札者名]さんが [金額] ポイントで入札しました。」                                           | オークション終了時  |
| 自分が入札した商品で最高額を更新された場合     | `OUTBID`                            | 入札者     | アプリ内, プッシュ, (メール: ユーザー設定による) | 「[商品名] の最高入札額が更新されました」<br/>「[新最高入札者名]さんが [金額] ポイントで入札し、あなたは最高入札者ではなくなりました。」 | オークション終了時  |
| 自分が出品した商品に質問が来た場合             | `QUESTION_RECEIVED`                 | 出品者     | アプリ内, (メール: ユーザー設定による)           | 「[商品名] に新しい質問が届きました」<br/>「出品した商品「[商品名]」に新しい質問があります。確認してください。」                         | オークション終了時  |
| 自動入札が設定した上限金額に達した場合         | `AUTO_BID_LIMIT_REACHED`            | 入札者     | アプリ内, プッシュ, (メール: ユーザー設定による) | 「[商品名] の自動入札が上限に達しました」<br/>「設定した自動入札の上限額に達したため、自動入札を停止しました。」                         | 通知送信から1ヶ月後 |
| 自分が出品した商品のオークションが終了した場合 | `AUCTION_ENDED_OWN_ITEM`            | 出品者     | アプリ内, (メール: ユーザー設定による)           | 「[商品名] のオークションが終了しました」<br/>「出品した商品「[商品名]」のオークション期間が終了しました。結果を確認してください。」     | 通知送信から1ヶ月後 |
| オークションを落札した場合                     | `AUCTION_WON`                       | 落札者     | アプリ内, メール, プッシュ                       | 「[商品名] を落札しました！」<br/>「おめでとうございます！「[商品名]」を [落札額] ポイントで落札しました。」                             | 通知送信から1ヶ月後 |
| オークションを落札できなかった場合             | `AUCTION_LOST`                      | 落札失敗者 | アプリ内                                         | 「[商品名] のオークションは落札できませんでした」<br/>「残念ながら、「[商品名]」のオークションは他のユーザーが落札しました。」           | 通知送信から1ヶ月後 |
| ポイントが返還された時                         | `POINT_RETURNED`                    | 落札者     | アプリ内, (メール: ユーザー設定による)           | 「オークションポイントが返還されました」<br/>「[商品名] のオークションで預けていたポイントが返還されました。」                           | 通知送信から1ヶ月後 |

**注意:**

- デフォルトの送信方法は基本的な推奨設定。ユーザーが通知設定で変更できるようにする。
- メッセージ内容は `getAuctionNotificationMessage` 関数で生成される。

## 8. UI仕様

### ヘッダー

- 既存のベルマーク（通常通知）の左隣に、オークション専用のアイコン（例: ハンマーアイコン）を配置する。
- 未読のオークション通知がある場合、アイコン右上に未読数をバッジ表示する。

### ホバー

- オークション通知アイコンにホバーすると、最新の未読通知数件のプレビュー（タイトル、一部本文）をドロップダウン等で表示する。

### モーダル

- オークション通知アイコンをクリックすると、オークション通知一覧モーダルを表示する。
- モーダル内には、受信したオークション通知がリスト表示される。
- 各通知には、アイコン、タイトル、本文、受信日時、関連オークションへのリンク（可能な場合）を表示する。
- 未読/既読の状態を表示し、クリックで既読にする機能。
- 通知削除機能（個別、一括）。
- ページネーション機能（通知件数が多い場合）。

## 9. 通知データの自動削除

- **目的:** 不要になった通知データを削除し、データベースの肥大化を防ぐ。
- **方法:** GitHub Actions の定期実行ワークフローを使用する。
- **実行タイミング:** 毎週日曜日 日本時間 深夜1時頃 (cron: `0 16 * * 0` UTC)
- **処理内容:**
  1. `AuctionNotification` テーブルを検索する。
  2. 各通知レコードについて、以下の条件で削除対象か判断する:
     - `eventType` が `NEW_BID_ON_OWN_ITEM`, `OUTBID`, `QUESTION_RECEIVED` のいずれかで、関連する `Auction` の `status` が `ENDED` または `CANCELED` になっている場合 (オークション終了時に削除)。
     - `eventType` が上記以外で、`createdAt` から1ヶ月以上経過している場合 (通知送信から1ヶ月後に削除)。
     - **(代替案)** `expiresAt` カラムを追加し、削除予定日時を保存。`expiresAt` が現在時刻を過ぎているレコードを削除する (`calculateExpiryDate` 関数の実装例参照)。
  3. 削除対象のレコードを `DELETE` 文で削除する。
  4. 処理結果（削除件数など）をログに出力する。

```mermaid
sequenceDiagram
    participant EventTrigger as オークションイベント<br/>(例: 新規入札)
    participant AuctionLogic as オークション処理ロジック
    participant NotificationService as sendAuctionNotification()
    participant MessageUtil as getAuctionNotificationMessage()
    participant DB as データベース<br/>(AuctionNotification, User, Auction)
    participant PushService as sendPushNotification()
    participant MailService as sendMailNotification()
    participant InAppService as sendInAppNotification()
    participant UserDevice as ユーザーデバイス/アプリ

    EventTrigger ->> AuctionLogic: イベント発生 (例: User Aが商品Xに入札)
    AuctionLogic ->> AuctionLogic: 入札処理、DB更新など
    AuctionLogic ->> NotificationService: sendAuctionNotification({<br/>  eventType: 'OUTBID',<br/>  recipientId: 'User B (前最高入札者)',<br/>  auctionId: 'auctionX_id',<br/>  relatedData: { bid: ... },<br/>  methods: { in_app: true, push: true, mail: false }<br/>})
    NotificationService ->> DB: 受信者(User B)情報取得 (prisma.user.findUnique)
    DB -->> NotificationService: User B データ
    NotificationService ->> DB: オークション(X)情報取得 (prisma.auction.findUnique)
    DB -->> NotificationService: Auction X データ (incl. Task)
    NotificationService ->> MessageUtil: getAuctionNotificationMessage('OUTBID', data, 'ja')
    MessageUtil -->> NotificationService: { title: "...", body: "..." }
    alt methods.in_app_notification is true
        NotificationService ->> InAppService: sendInAppNotification({ recipientId: 'User B', auctionId: 'auctionX_id', ... })
        InAppService ->> DB: AuctionNotification レコード作成 (prisma.auctionNotification.create)
        DB -->> InAppService: 作成成功
        InAppService -->> NotificationService: 成功
        Note over UserDevice: アプリ内で通知表示更新
    end
    alt methods.push_notification is true
        NotificationService ->> PushService: sendPushNotification({ userId: 'User B', data: { auctionId: 'auctionX_id', ... } })
        PushService ->> PushService: 外部プッシュサービス連携 (FCM/APNS)
        PushService -->> NotificationService: 送信試行
        Note over UserDevice: プッシュ通知受信
    end
    alt methods.mail_notification is true
        NotificationService ->> MailService: sendMailNotification({ to: 'userB@email.com', ... })
        MailService ->> MailService: 外部メールサービス連携 (SendGrid)
        MailService -->> NotificationService: 送信試行
        Note over UserDevice: メール受信
    end
    NotificationService -->> AuctionLogic: 通知処理完了 (非同期)
```
