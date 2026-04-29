import type { BidHistory, NotificationSendMethod, NotificationSendTiming, Prisma, PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker/locale/ja";
import { AuctionEventType, BidStatus, NotificationTargetType, TaskStatus } from "@prisma/client";

import type { SeedAuction, SeedGroup, SeedTask, SeedUser } from "./types";
import { PRESERVED_USER_IDS, SEED_CONFIG } from "./config";

/**
 * 通知データを生成する関数 (オークション関連を除く)
 * @param users ユーザーの配列
 * @param groups グループの配列
 * @param tasks タスクの配列
 * @param groupMemberships グループメンバーシップの配列
 * @param prisma Prismaクライアントのインスタンス
 * @returns 生成された通知の配列
 */
export async function createNotifications(
  users: SeedUser[],
  groups: SeedGroup[],
  tasks: SeedTask[],
  groupMemberships: Prisma.GroupMembershipGetPayload<{ select: { userId: true; groupId: true } }>[],
  prisma: PrismaClient,
) {
  const notifications = [];
  // オークション関連のターゲットタイプを除外
  const targetTypes = Object.values(NotificationTargetType).filter(
    (t) => t !== NotificationTargetType.AUCTION_SELLER && t !== NotificationTargetType.AUCTION_BIDDER,
  );
  const preservedUserIds = new Set(PRESERVED_USER_IDS);
  const preservedUsers = users.filter((user) => preservedUserIds.has(user.id));
  const otherUsers = users.filter((user) => !preservedUserIds.has(user.id));

  const allUsers = [...preservedUsers, ...otherUsers]; // 保持ユーザーを先頭に

  // 各ユーザーに対して通知を生成 (通知の「受信者」としてのループ)
  for (const recipientUser of allUsers) {
    const notificationCount = faker.number.int({
      min: SEED_CONFIG.NOTIFICATIONS_PER_USER_MIN,
      max: SEED_CONFIG.NOTIFICATIONS_PER_USER_MAX,
    });

    for (let i = 0; i < notificationCount; i++) {
      const targetType = faker.helpers.arrayElement(targetTypes);
      const daysPast = faker.number.int({ min: 1, max: 30 }); // minを1に変更
      const sentAt = faker.date.recent({ days: daysPast }); // よりシンプルに

      let title: string,
        message: string,
        actionUrl: string | null = null;
      let groupId: string | null = null;
      let taskId: string | null = null;
      // 通知の「送信者」を決定 (SYSTEM通知以外)
      let senderUser: SeedUser | null = null;
      if (targetType !== "SYSTEM") {
        // 送信者候補 (受信者以外)
        const potentialSenders = users.filter((u) => u.id !== recipientUser.id);
        const preservedSenders = potentialSenders.filter((u) => preservedUserIds.has(u.id));
        const otherSenders = potentialSenders.filter((u) => !preservedUserIds.has(u.id));

        // const PRESERVED_SENDER_PROBABILITY = 0.2; // SEED_CONFIGから取得するように変更
        if (potentialSenders.length > 0) {
          if (
            preservedSenders.length > 0 &&
            faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_NOTIFICATION_SENDER_PROBABILITY)
          ) {
            senderUser = faker.helpers.arrayElement(preservedSenders);
          } else {
            senderUser = faker.helpers.arrayElement(otherSenders.length > 0 ? otherSenders : potentialSenders);
          }
        }
      }
      const senderUserId = senderUser?.id ?? null; // システム通知の場合は null

      switch (targetType) {
        case "SYSTEM":
          title = faker.helpers.arrayElement(["システムメンテナンス", "お知らせ", "アップデート情報"]);
          message = faker.lorem.paragraph();
          break;
        case "USER":
          title = faker.helpers.arrayElement(["アカウント情報更新", "プロフィール確認", "個人設定変更"]);
          // 送信者がいる場合はメッセージに含める
          message = senderUser
            ? `${senderUser.name}さんからのお知らせ: ${faker.lorem.sentence()}`
            : faker.lorem.sentence();
          actionUrl = `/dashboard/profile/${recipientUser.id}`; // 受信者のプロフィールへのリンク
          break;
        case "GROUP":
          // 受信者が所属するグループ、または送信者が所属するグループからランダムに選択
          const relevantGroups = groups.filter((g) =>
            groupMemberships.some(
              (m) =>
                m.groupId === g.id && (m.userId === recipientUser.id || (senderUserId && m.userId === senderUserId)),
            ),
          );
          const randomGroup =
            relevantGroups.length > 0
              ? faker.helpers.arrayElement(relevantGroups)
              : groups.length > 0
                ? faker.helpers.arrayElement(groups)
                : null;

          if (randomGroup) {
            groupId = randomGroup.id;
            title = faker.helpers.arrayElement([
              `「${randomGroup.name}」の新着情報`,
              `「${randomGroup.name}」からのお知らせ`,
            ]);
            message = senderUser
              ? `${senderUser.name}さんがグループ「${randomGroup.name}」で投稿しました: ${faker.lorem.paragraph()}`
              : `グループ「${randomGroup.name}」のお知らせ: ${faker.lorem.paragraph()}`;
            actionUrl = `/dashboard/group/${randomGroup.id}`;
          } else {
            // 関連グループがない場合はスキップ
            continue;
          }
          break;
        case "TASK":
          // 受信者または送信者に関連するタスクを選択
          const relevantTasks = tasks.filter((t) => {
            const isCreator = t.creatorId === recipientUser.id || (senderUserId && t.creatorId === senderUserId);
            const isReporter = t.reporters?.some(
              (r) => r.userId === recipientUser.id || (senderUserId && r.userId === senderUserId),
            );
            const isExecutor = t.executors?.some(
              (e) => e.userId === recipientUser.id || (senderUserId && e.userId === senderUserId),
            );
            return Boolean(isCreator) || Boolean(isReporter) || Boolean(isExecutor); // Boolean() でラップ
          });
          const randomTask =
            relevantTasks.length > 0
              ? faker.helpers.arrayElement(relevantTasks)
              : tasks.length > 0
                ? faker.helpers.arrayElement(tasks)
                : null;

          if (randomTask?.id) {
            taskId = randomTask.id;
            groupId = randomTask.groupId ?? null;
            title = faker.helpers.arrayElement([
              `タスク「${randomTask.task.substring(0, 15)}...」更新`,
              `タスク期限通知`,
              `タスク評価完了`,
            ]);
            message = senderUser
              ? `${senderUser.name}さんがタスク「${randomTask.task.substring(0, 15)}...」を更新しました。`
              : `タスク「${randomTask.task.substring(0, 15)}...」に関するお知らせです。`;
            actionUrl = `/dashboard/tasks/${randomTask.id}`;
          } else {
            continue; // 有効なタスクがない場合はスキップ
          }
          break;
        default: // 実質 USER, GROUP, TASK のみ考慮
          title = "お知らせ";
          message = faker.lorem.paragraph();
          break;
      }

      const hasExpiry = faker.datatype.boolean(SEED_CONFIG.NOTIFICATION_EXPIRY_PROBABILITY);
      const expiresAt = hasExpiry ? faker.date.future({ refDate: sentAt }) : null;

      // 既読状態のJSONBデータ: 受信者は必ずキーとして含める
      const isReadJsonb: Record<string, { isRead: boolean; readAt: string | null }> = {};
      const recipientIsRead = faker.datatype.boolean(SEED_CONFIG.NOTIFICATION_READ_PROBABILITY);
      isReadJsonb[recipientUser.id] = {
        isRead: recipientIsRead,
        readAt: recipientIsRead ? faker.date.between({ from: sentAt, to: new Date() }).toISOString() : null,
      };
      // 他のランダムなユーザー（保持ユーザー含む）の既読状態も追加
      const otherReadStatusUsers = faker.helpers.arrayElements(
        users.filter((u) => u.id !== recipientUser.id), // 受信者以外
        faker.number.int({ min: 0, max: 2 }), // 0~2人の他のユーザー
      );
      for (const otherUser of otherReadStatusUsers) {
        const isRead = faker.datatype.boolean(0.3); // 他のユーザーは低確率で既読
        isReadJsonb[otherUser.id] = {
          isRead,
          readAt: isRead ? faker.date.between({ from: sentAt, to: new Date() }).toISOString() : null,
        };
      }

      try {
        const notificationData = {
          title,
          message,
          targetType: targetType as NotificationTargetType,
          sendTimingType: "NOW" as NotificationSendTiming, // 型アサーション
          sentAt,
          expiresAt,
          actionUrl,
          senderUserId,
          groupId,
          taskId,
          isRead: isReadJsonb,
          sendMethods: ["IN_APP"] as NotificationSendMethod[], // 型アサーション
          // auctionId, auctionEventType はここでは null or undefined
        };

        const notification = await prisma.notification.create({ data: notificationData });
        notifications.push(notification);
      } catch (error) {
        console.error("通知作成エラー:", error);
        // console.error("エラーデータ:", notificationData); // デバッグ用
      }
    }
  }

  console.log(`${notifications.length}件の通知(非オークション)を作成しました`);
  return notifications;
}

/**
 * オークション通知を生成する関数
 * @param auctions オークションの配列
 * @param users ユーザーの配列
 * @param prisma Prismaクライアントのインスタンス
 * @returns 生成された通知の配列
 */
export async function createAuctionNotifications(auctions: SeedAuction[], users: SeedUser[], prisma: PrismaClient) {
  console.log("Creating auction notifications...");

  const notifications = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  // 各ユーザーに対して通知を生成 (受信者としてのループ)
  for (const recipientUser of users) {
    // ユーザーが関わっているオークション（出品者、入札者、落札者、ウォッチリスト登録者）
    const relatedAuctions = await prisma.auction.findMany({
      where: {
        OR: [
          { task: { creatorId: recipientUser.id } }, // 出品者
          { bidHistories: { some: { userId: recipientUser.id } } }, // 入札者
          { winnerId: recipientUser.id }, // 落札者
          { watchlists: { some: { userId: recipientUser.id } } }, // ウォッチリスト登録者
        ],
      },
      include: {
        task: { select: { creatorId: true, task: true, deliveryMethod: true, status: true } },
        bidHistories: { where: { userId: recipientUser.id }, select: { status: true } },
      }, // 関連情報も取得
    });

    // 関連オークションがない場合でも、保持ユーザーなら他のオークション通知を受け取る可能性
    const isPreservedUser = preservedUserIds.has(recipientUser.id);
    // statusを補完してSeedAuction型に合わせる
    const auctionsToNotify: (SeedAuction & {
      task?: { creatorId: string; task?: string; deliveryMethod?: string | null; status?: TaskStatus };
      bidHistories?: { status: BidStatus }[];
    })[] = relatedAuctions.map((a) => ({
      ...a,
      status: a.task?.status ?? TaskStatus.PENDING, // task.statusをSeedAuction.statusに流用
      extensionTime: a.extensionTime ?? 10, // デフォルト値を設定
      remainingTimeForExtension: a.remainingTimeForExtension ?? 10, // デフォルト値を設定
      task: a.task,
      bidHistories: a.bidHistories,
    }));
    if (isPreservedUser && relatedAuctions.length < 2 && auctions.length >= 2) {
      const otherAuctionIds = auctions.filter((a) => !relatedAuctions.some((ra) => ra.id === a.id)).map((a) => a.id);
      if (otherAuctionIds.length > 0) {
        const otherAuctionsData = await prisma.auction.findMany({
          where: { id: { in: faker.helpers.arrayElements(otherAuctionIds, 2 - relatedAuctions.length) } },
          include: {
            task: { select: { creatorId: true, task: true, deliveryMethod: true, status: true } },
            bidHistories: { where: { userId: recipientUser.id }, select: { status: true } },
          },
        });
        auctionsToNotify.push(
          ...otherAuctionsData.map((a) => ({
            ...a,
            status: a.task?.status ?? TaskStatus.PENDING,
            extensionTime: a.extensionTime ?? 10, // デフォルト値を設定
            remainingTimeForExtension: a.remainingTimeForExtension ?? 10, // デフォルト値を設定
            task: a.task,
            bidHistories: a.bidHistories,
          })),
        );
      }
    }

    if (auctionsToNotify.length === 0) continue;

    for (const auction of auctionsToNotify) {
      const sellerId = auction.task?.creatorId;
      if (!sellerId) continue; // 出品者不明の場合はスキップ

      const notificationCount = faker.number.int({
        min: SEED_CONFIG.AUCTION_NOTIFICATIONS_PER_RELEVANT_AUCTION_MIN,
        max: SEED_CONFIG.AUCTION_NOTIFICATIONS_PER_RELEVANT_AUCTION_MAX,
      });

      // 通知タイプのリスト (ユーザーの役割に応じてフィルタリング)
      let possibleEventTypes: AuctionEventType[] = [];
      if (recipientUser.id === sellerId) {
        // 受信者が出品者
        possibleEventTypes = [
          AuctionEventType.ITEM_SOLD,
          AuctionEventType.NO_WINNER,
          AuctionEventType.ENDED,
          AuctionEventType.QUESTION_RECEIVED,
          AuctionEventType.AUCTION_CANCELED,
        ];
      } else {
        // 受信者が出品者以外
        possibleEventTypes = [
          AuctionEventType.OUTBID,
          AuctionEventType.ENDED,
          AuctionEventType.AUCTION_WIN,
          AuctionEventType.AUCTION_LOST,
          AuctionEventType.POINT_RETURNED,
          AuctionEventType.AUTO_BID_LIMIT_REACHED,
          AuctionEventType.AUCTION_CANCELED,
        ];
        if (auction.winnerId !== recipientUser.id) {
          possibleEventTypes = possibleEventTypes.filter((t) => t !== AuctionEventType.AUCTION_WIN);
        }
        // bidHistories を auction オブジェクトから直接参照
        const hasBid = auction.bidHistories && auction.bidHistories.length > 0;
        if (!hasBid) {
          // possibleEventTypes = possibleEventTypes.filter(t => !([AuctionEventType.OUTBID, AuctionEventType.AUCTION_LOST, AuctionEventType.AUTO_BID_LIMIT_REACHED] as const).includes(t));
          const excludedTypes: AuctionEventType[] = [
            AuctionEventType.OUTBID,
            AuctionEventType.AUCTION_LOST,
            AuctionEventType.AUTO_BID_LIMIT_REACHED,
          ]; // 型を明示
          possibleEventTypes = possibleEventTypes.filter((t) => !excludedTypes.some((excluded) => excluded === t)); // some を使用して書き換え
        }
        // Lost していない場合は AUCTION_LOST を除外
        if (hasBid && !auction.bidHistories?.some((b) => b.status === BidStatus.LOST)) {
          possibleEventTypes = possibleEventTypes.filter((t) => t !== AuctionEventType.AUCTION_LOST);
        }
        // Won していない場合は POINT_RETURNED (落札ポイント返還) を除外 (負けた場合の返還もあるが、ここでは単純化)
        if (auction.winnerId !== recipientUser.id) {
          possibleEventTypes = possibleEventTypes.filter((t) => t !== AuctionEventType.POINT_RETURNED);
        }
      }
      possibleEventTypes = possibleEventTypes.filter((et) => Object.values(AuctionEventType).includes(et));
      if (possibleEventTypes.length === 0) continue;

      for (let i = 0; i < notificationCount; i++) {
        const notificationType = faker.helpers.arrayElement(possibleEventTypes); // AuctionEventTypeがインポートされていれば問題ない

        const createdAt = faker.date.recent({ days: 7 });
        const expiresAt = faker.date.future({ refDate: createdAt });

        const taskInfo = auction.task
          ? { task: auction.task.task, deliveryMethod: auction.task.deliveryMethod, groupId: auction.groupId }
          : null;

        let pointReturnDate = null;
        if (notificationType === AuctionEventType.POINT_RETURNED && auction.status === TaskStatus.AUCTION_ENDED) {
          // AuctionEventTypeを使用
          const group = await prisma.group.findUnique({
            where: { id: auction.groupId },
            select: { depositPeriod: true },
          });
          if (group) {
            pointReturnDate = new Date(auction.endTime);
            pointReturnDate.setDate(pointReturnDate.getDate() + group.depositPeriod);
          }
        }

        const sendMethods = faker.helpers.arrayElements(
          ["IN_APP", "EMAIL", "WEB_PUSH"] as const,
          faker.number.int({ min: 1, max: 2 }),
        ) as NotificationSendMethod[];
        const isReadJson = { [recipientUser.id]: { isRead: false, readAt: null } };

        try {
          const title = generateNotificationTitle(notificationType); // AuctionEventTypeが解決されれば問題ない
          const message = generateNotificationMessage(notificationType, auction, taskInfo, pointReturnDate); // AuctionEventTypeが解決されれば問題ない
          const senderUserId = null; // システム通知
          const targetType =
            recipientUser.id === sellerId
              ? NotificationTargetType.AUCTION_SELLER
              : NotificationTargetType.AUCTION_BIDDER;

          const notification = await prisma.notification.create({
            data: {
              title,
              message,
              auctionEventType: notificationType,
              targetType, // AuctionEventTypeが解決されれば問題ない
              sendTimingType: "NOW",
              sendMethods,
              sentAt: createdAt,
              expiresAt,
              actionUrl: `/dashboard/auction/${auction.id}`,
              isRead: isReadJson,
              senderUserId,
              auctionId: auction.id,
              taskId: auction.taskId,
              groupId: taskInfo?.groupId ?? null,
            },
          });
          notifications.push(notification);
        } catch (error) {
          console.error(
            `オークション通知作成エラー (タイプ: ${notificationType}, 受信者: ${recipientUser.id}):`,
            error,
          );
        }
      }
    }
  }

  console.log(`Created ${notifications.length} auction notifications`);
  return notifications;
}

/**
 * 出品者への通知作成を別関数に分離
 * @param auction オークション情報
 * @param eventType イベントタイプ
 * @param prisma Prismaクライアントのインスタンス
 */
export async function createSellerNotification(auction: SeedAuction, eventType: string, prisma: PrismaClient) {
  const taskSeller = await prisma.task.findUnique({
    where: { id: auction.taskId },
    select: { creatorId: true },
  });

  if (!taskSeller) return;

  const sellerId = taskSeller.creatorId;
  const sellerReadStatus = { [sellerId]: { isRead: false, readAt: null } };

  await prisma.notification.create({
    data: {
      title: generateNotificationTitle(eventType),
      message: generateNotificationMessage(eventType, auction),
      targetType: "AUCTION_SELLER",
      auctionEventType: eventType as AuctionEventType,
      sendTimingType: "NOW",
      sendMethods: ["IN_APP"],
      auctionId: auction.id,
      isRead: sellerReadStatus,
      senderUserId: null,
    },
  });
}

/**
 * オークション終了時の通知作成を別関数に分離
 * @param auction オークション情報
 * @param winnerFound 落札者が見つかったか
 * @param winnerId 落札者ID
 * @param sortedBids ソート済み入札履歴
 * @param prisma Prismaクライアントのインスタンス
 */
export async function createAuctionEndNotifications(
  auction: SeedAuction,
  winnerFound: boolean,
  winnerId: string | null,
  sortedBids: BidHistory[],
  prisma: PrismaClient,
) {
  const taskSeller = await prisma.task.findUnique({
    where: { id: auction.taskId },
    select: { creatorId: true },
  });

  if (!taskSeller) return;

  const sellerId = taskSeller.creatorId;
  const sellerReadStatus = { [sellerId]: { isRead: false, readAt: null } };

  if (winnerFound && winnerId) {
    const winnerReadStatus = { [winnerId]: { isRead: false, readAt: null } };

    // 出品者への落札通知
    await prisma.notification.create({
      data: {
        title: generateNotificationTitle("ITEM_SOLD"),
        message: generateNotificationMessage("ITEM_SOLD", auction),
        targetType: "AUCTION_SELLER",
        auctionEventType: "ITEM_SOLD",
        sendTimingType: "NOW",
        sendMethods: ["IN_APP"],
        auctionId: auction.id,
        isRead: sellerReadStatus,
        senderUserId: null,
      },
    });

    // 落札者への勝利通知
    await prisma.notification.create({
      data: {
        title: generateNotificationTitle("AUCTION_WIN"),
        message: generateNotificationMessage("AUCTION_WIN", auction),
        targetType: "AUCTION_BIDDER",
        auctionEventType: "AUCTION_WIN",
        sendTimingType: "NOW",
        sendMethods: ["IN_APP"],
        auctionId: auction.id,
        isRead: winnerReadStatus,
        senderUserId: null,
      },
    });
  } else {
    // 落札者がいない場合の通知
    await prisma.notification.create({
      data: {
        title: generateNotificationTitle("NO_WINNER"),
        message: generateNotificationMessage("NO_WINNER", auction),
        targetType: "AUCTION_SELLER",
        auctionEventType: "NO_WINNER",
        sendTimingType: "NOW",
        sendMethods: ["IN_APP"],
        auctionId: auction.id,
        isRead: sellerReadStatus,
        senderUserId: null,
      },
    });
  }

  // 出品者への終了通知
  await prisma.notification.create({
    data: {
      title: generateNotificationTitle("ENDED"),
      message: generateNotificationMessage("ENDED", auction),
      targetType: "AUCTION_SELLER",
      auctionEventType: "ENDED",
      sendTimingType: "NOW",
      sendMethods: ["IN_APP"],
      auctionId: auction.id,
      isRead: sellerReadStatus,
      senderUserId: null,
    },
  });

  // 敗者への通知
  for (const bid of sortedBids) {
    const latestBid = await prisma.bidHistory.findUnique({
      where: { id: bid.id },
      select: { status: true },
    });

    if (latestBid?.status === BidStatus.LOST) {
      const loserReadStatus = { [bid.userId]: { isRead: false, readAt: null } };
      await prisma.notification.create({
        data: {
          title: generateNotificationTitle("AUCTION_LOST"),
          message: generateNotificationMessage("AUCTION_LOST", auction),
          targetType: "AUCTION_BIDDER",
          auctionEventType: "AUCTION_LOST",
          sendTimingType: "NOW",
          sendMethods: ["IN_APP"],
          auctionId: auction.id,
          isRead: loserReadStatus,
          senderUserId: null,
        },
      });
    }
  }
}

/**
 * 通知タイトルの生成ヘルパー関数
 * @param type 通知タイプ
 * @returns 通知タイトル
 */
export function generateNotificationTitle(type: string): string {
  switch (type) {
    case "ITEM_SOLD":
      return "商品が落札されました";
    case "NO_WINNER":
      return "落札者がいませんでした";
    case "ENDED":
      return "オークション終了";
    case "OUTBID":
      return "入札が上回られました";
    case "QUESTION_RECEIVED":
      return "質問を受け取りました";
    case "AUTO_BID_LIMIT_REACHED":
      return "自動入札上限に達しました";
    case "AUCTION_WIN":
      return "オークション落札成功";
    case "AUCTION_LOST":
      return "オークション落札失敗";
    case "POINT_RETURNED":
      return "ポイント返還予定のお知らせ";
    default:
      return "オークション通知";
  }
}

/**
 * 通知メッセージの生成ヘルパー関数
 * @param type 通知タイプ
 * @param auction オークション情報
 * @param task タスク情報
 * @param pointReturnDate ポイント返還日
 * @returns 通知メッセージ
 */
export function generateNotificationMessage(
  type: string,
  auction: SeedAuction,
  task?: { task?: string; deliveryMethod?: string | null; groupId?: string } | null,
  pointReturnDate?: Date | null,
): string {
  const taskTitle = task?.task ? task.task.substring(0, 30) + (task.task.length > 30 ? "..." : "") : "商品";
  const deliveryMethod = task?.deliveryMethod ?? "未定";
  const bidAmount = auction.currentHighestBid.toLocaleString();

  switch (type) {
    case "ITEM_SOLD":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。\n預けたポイントは${formattedDate}に返還される予定です。`;
      }
      return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。`;
    case "NO_WINNER":
      return `残念ながら「${taskTitle}」のオークションで落札できませんでした。入札したポイントは返還されました。`;
    case "ENDED":
      return `「${taskTitle}」のオークションが終了しました。結果を確認してください。`;
    case "OUTBID":
      return `「${taskTitle}」のオークションで、あなたの入札が他のユーザーに上回られました。再入札を検討してください。`;
    case "QUESTION_RECEIVED":
      return `「${taskTitle}」のオークションに関する質問を受け取りました。`;
    case "AUTO_BID_LIMIT_REACHED":
      return `「${taskTitle}」のオークションで自動入札上限に達しました。`;
    case "AUCTION_WIN":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。\n預けたポイントは${formattedDate}に返還される予定です。`;
      }
      return `おめでとうございます！「${taskTitle}」を${bidAmount}ポイントで落札しました。提供方法は「${deliveryMethod}」です。`;
    case "AUCTION_LOST":
      return `残念ながら「${taskTitle}」のオークションで落札できませんでした。入札したポイントは返還されました。`;
    case "POINT_RETURNED":
      if (pointReturnDate) {
        const formattedDate = pointReturnDate.toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return `「${taskTitle}」のオークションで預けた${bidAmount}ポイントは${formattedDate}に返還される予定です。`;
      }
      return `「${taskTitle}」のオークションで使用したポイントが返還されました。`;
    default:
      return `「${taskTitle}」のオークションに関するお知らせです。`;
  }
}
