/**
 * オークションの完了処理を行うスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 */
import { fileURLToPath } from "node:url";
import type { Prisma, PrismaClient } from "@prisma/client";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { AuctionEventType, BidStatus, NotificationSendMethod, NotificationSendTiming, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Prismaトランザクションの型定義
 */
export type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク（オークション付き）の関連データを含む型
 */
export type TaskWithRelations = Prisma.TaskGetPayload<{
  select: {
    id: true;
    task: true;
    groupId: true;
    auction: {
      select: {
        id: true;
        bidHistories: {
          select: {
            id: true;
            amount: true;
            status: true;
            userId: true;
            user: {
              select: {
                id: true;
              };
            };
          };
          orderBy: {
            amount: "desc";
          };
        };
      };
    };
    group: {
      select: {
        id: true;
      };
    };
  };
}>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知送信用のデータ型
 */
type NotificationData = {
  taskId: string;
  taskName: string;
  eventType: AuctionEventType;
  recipientUserId: string[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの完了処理を行う
 * endTimeが現在日時以前かつstatusがACTIVEまたはPENDINGのオークションを処理する
 * @returns 処理されたオークションの数
 */
export async function updateAuctionStatusToCompleted(): Promise<number> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 現在の日時を取得
     */
    const now = new Date();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 処理対象のオークションを取得
     * endTimeが現在日時以前かつstatusがACTIVEまたはPENDINGのオークション
     */
    const auctions = await prisma.task.findMany({
      where: {
        status: {
          in: [TaskStatus.AUCTION_ACTIVE, TaskStatus.PENDING],
        },
        auction: {
          endTime: {
            lte: now,
          },
        },
      },
      select: {
        id: true,
        task: true,
        groupId: true,
        auction: {
          select: {
            id: true,
            bidHistories: {
              select: {
                id: true,
                amount: true,
                status: true,
                userId: true,
                user: {
                  select: {
                    id: true,
                  },
                },
              },
              orderBy: {
                amount: "desc",
              },
            },
          },
        },
        group: {
          select: {
            id: true,
          },
        },
      },
    });

    console.log(`処理対象のオークション: ${auctions.length}件`);

    // 処理したオークションの数
    let processedCount = 0;

    // 各オークションに対して処理
    for (const task of auctions) {
      try {
        // 通知データを格納する配列
        const notificationsToSend: NotificationData[] = [];

        // トランザクションを開始（タイムアウト時間を15秒に設定）
        await prisma.$transaction(
          async (tx) => {
            // 入札履歴があるかチェック
            if (!task.auction || task.auction.bidHistories.length === 0) {
              // 入札がない場合の処理
              const notifications = await handleAuctionWithNoBids(tx, task);
              notificationsToSend.push(...notifications);
            } else {
              // 入札がある場合の処理
              const notifications = await handleAuctionWithBids(tx, task);
              notificationsToSend.push(...notifications);
            }
          },
          {
            timeout: 15000, // 15秒のタイムアウト
          },
        );

        // トランザクション完了後に通知を送信
        for (const notificationData of notificationsToSend) {
          await sendNotificationAsync(notificationData);
        }

        processedCount++;
        console.log(`オークション(ID: ${task.id})の処理完了`);
      } catch (error) {
        console.error(`オークション(ID: ${task.id})の処理中にエラーが発生:`, error);
      }
    }

    return processedCount;
  } catch (error) {
    console.error("オークション終了処理でエラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札がないオークションの処理
 * @param tx トランザクションオブジェクト
 * @param task オークションオブジェクト
 * @returns 送信する通知データの配列
 */
export async function handleAuctionWithNoBids(tx: PrismaTransaction, task: TaskWithRelations): Promise<NotificationData[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/scripts/update-auction-status-to-completed.ts_handleAuctionWithNoBids_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションのステータスを更新
   */
  await tx.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.ARCHIVED,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク作成者のIDを取得
   */
  const creatorId = await getTaskCreatorId(tx, task);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 送信する通知データを準備
   */
  const notifications: NotificationData[] = [
    // 出品者への通知（オークション終了）
    {
      taskId: task.id,
      taskName: task.task,
      eventType: AuctionEventType.ENDED,
      recipientUserId: creatorId,
    },
    // 出品者への通知（落札者なし）
    {
      taskId: task.id,
      taskName: task.task,
      eventType: AuctionEventType.NO_WINNER,
      recipientUserId: creatorId,
    },
  ];

  return notifications;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札があるオークションの処理
 * @param tx トランザクションオブジェクト
 * @param task オークションオブジェクト
 * @returns 送信する通知データの配列
 */
export async function handleAuctionWithBids(tx: PrismaTransaction, task: TaskWithRelations): Promise<NotificationData[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/scripts/update-auction-status-to-completed.ts_handleAuctionWithBids_start");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 有効な入札（BIDDING状態）のみを抽出し、金額の降順で並べる
   */
  const validBids = task.auction?.bidHistories?.filter((bid) => bid.status === BidStatus.BIDDING).sort((a, b) => b.amount - a.amount) ?? [];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 有効な入札がない場合は入札なしと同じ処理
   */
  if (validBids.length === 0) {
    return await handleAuctionWithNoBids(tx, task);
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 最高額の入札者（落札候補者）
   */
  const winnerBid = validBids[0];
  const winnerUser = winnerBid.user;
  let depositAmount: number;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札金額の決定
   */
  if (validBids.length === 1) {
    // 入札者が1人のみの場合は、depositPointが0
    depositAmount = 0;
  } else {
    // 入札者が複数の場合、次点+1ポイントが落札額
    depositAmount = validBids[1].amount + 1;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札者のポイント残高を確認
   */
  const winnerGroupPoint = await tx.groupPoint.findUnique({
    where: {
      userId_groupId: {
        userId: winnerUser.id,
        groupId: task.groupId,
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ポイント残高が不足している場合、次の入札者を試す
   */
  if (!winnerGroupPoint || winnerGroupPoint.balance < depositAmount) {
    // 現在の最高入札者のステータスをINSUFFICIENTに更新
    await tx.bidHistory.update({
      where: { id: winnerBid.id },
      data: { status: BidStatus.INSUFFICIENT },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 次の入札者で再試行
     */
    const remainingBids = validBids.slice(1);
    if (remainingBids.length > 0) {
      // 更新されたオークションを再取得
      const updatedTask = await tx.task.findUnique({
        where: { id: task.id },
        select: {
          id: true,
          task: true,
          groupId: true,
          auction: {
            select: {
              id: true,
              bidHistories: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  userId: true,
                  user: {
                    select: {
                      id: true,
                    },
                  },
                },
                orderBy: { amount: "desc" },
              },
            },
          },
          group: {
            select: {
              id: true,
            },
          },
        },
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 残りの入札で再処理
       */
      if (updatedTask?.auction) {
        // 残りの入札で再処理
        const taskWithRemainingBids = {
          ...updatedTask,
          auction: {
            ...updatedTask.auction,
            bidHistories: remainingBids,
          },
        };
        return await handleAuctionWithBids(tx, taskWithRemainingBids);
      }
      return [];
    } else {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 有効な入札者がいなくなった場合
       */
      return await handleAuctionWithNoBids(tx, task);
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ポイントを差し引く
   */
  await tx.groupPoint.update({
    where: {
      userId_groupId: {
        userId: winnerUser.id,
        groupId: task.groupId,
      },
    },
    data: {
      balance: {
        decrement: depositAmount,
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札した入札のdepositPointを更新
   */
  await tx.bidHistory.update({
    where: { id: winnerBid.id },
    data: {
      status: BidStatus.WON,
      depositPoint: depositAmount,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 他の入札ステータスをLOSTに更新（INSUFFICIENTを除く）
   */
  if (!task.auction) return [];
  await tx.bidHistory.updateMany({
    where: {
      auctionId: task.auction.id,
      status: BidStatus.BIDDING,
      id: { not: winnerBid.id },
    },
    data: {
      status: BidStatus.LOST,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オークションのウィナーを更新
   */
  await tx.auction.update({
    where: { id: task.auction.id },
    data: {
      winnerId: winnerUser.id,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクのステータスを更新
   */
  await tx.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.POINTS_DEPOSITED,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク作成者のIDを取得
   */
  const creatorId = await getTaskCreatorId(tx, task);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 送信する通知データを準備
   */
  const notifications: NotificationData[] = [
    // 出品者への通知（オークション終了）
    {
      taskId: task.id,
      taskName: task.task,
      eventType: AuctionEventType.ENDED,
      recipientUserId: creatorId,
    },
    // 出品者への通知（商品落札）
    {
      taskId: task.id,
      taskName: task.task,
      eventType: AuctionEventType.ITEM_SOLD,
      recipientUserId: creatorId,
    },
    // 落札者への通知
    {
      taskId: task.id,
      taskName: task.task,
      eventType: AuctionEventType.AUCTION_WIN,
      recipientUserId: [winnerUser.id],
    },
  ];

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 落札できなかった入札者への通知を追加
   */
  for (const bid of validBids) {
    if (bid.id !== winnerBid.id && bid.status !== BidStatus.INSUFFICIENT) {
      notifications.push({
        taskId: task.id,
        taskName: task.task,
        eventType: AuctionEventType.AUCTION_LOST,
        recipientUserId: [bid.userId],
      });
    }
  }

  return notifications;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成者のIDを取得する
 * @param tx トランザクションオブジェクト
 * @param task オークションオブジェクト
 * @returns タスク作成者ID（配列形式）
 */
async function getTaskCreatorId(tx: PrismaTransaction, task: TaskWithRelations): Promise<string[]> {
  const taskCreator = await tx.task.findUnique({
    where: { id: task.id },
    select: { creatorId: true },
  });

  return taskCreator ? [taskCreator.creatorId] : [];
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知を非同期で送信する
 * @param notificationData 通知データ
 */
async function sendNotificationAsync(notificationData: NotificationData): Promise<void> {
  const { taskId, taskName, eventType, recipientUserId } = notificationData;

  if (!recipientUserId || recipientUserId.length === 0) {
    console.log(`通知送信をスキップします: 受信者IDがありません。イベントタイプ: ${eventType}`);
    return;
  }

  try {
    // オークション詳細ページのURL
    const actionUrl = `/auctions/${taskId}`;

    // sendAuctionNotificationを呼び出し
    const notificationParams = {
      text: {
        first: taskName,
        second: taskName,
      },
      auctionEventType: eventType,
      auctionId: taskId,
      recipientUserId: recipientUserId,
      sendMethods: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
      actionUrl: actionUrl,
      sendTiming: NotificationSendTiming.NOW,
      sendScheduledDate: null,
      expiresAt: null,
    };

    const result = await sendAuctionNotification(notificationParams);

    if (result.success) {
      console.log(`通知を送信しました: イベントタイプ ${eventType}, 受信者 ${recipientUserId.join(", ")}`);
    } else {
      console.error(`通知送信に失敗しました: ${result.error}`);
    }
  } catch (error) {
    console.error(`通知送信中にエラーが発生しました:`, error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メイン関数
 */
async function main() {
  try {
    console.log("オークションの完了処理を開始します...");

    // オークション完了処理を実行
    const processedCount = await updateAuctionStatusToCompleted();

    console.log(`処理が完了しました。${processedCount}件のオークションを処理しました。`);
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// スクリプト実行（テスト環境では実行しない）
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error("スクリプト実行中にエラーが発生しました:", error);
    process.exit(1);
  });
}
