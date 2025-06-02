#!/usr/bin/env tsx
/**
 * オークションのポイント返還処理を行うスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 */
import { fileURLToPath } from "node:url";
import { sendAuctionNotification } from "@/lib/actions/notification/auction-notification";
import { prisma } from "@/lib/prisma";
import { NotificationSendMethod, NotificationSendTiming } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションのポイント返還処理を行う
 * 以下の条件に合致するオークションのポイントを返還する:
 * 1. endTime + group.depositPeriodの日数が今日以前
 * 2. Auctionのステータスが「ENDED」
 *
 * @returns 処理されたオークションの数
 */
export async function returnAuctionDepositPoints(): Promise<number> {
  try {
    // 現在の日時を取得
    const now = new Date();

    // 対象となるオークションを取得
    const targetAuctions = await prisma.auction.findMany({
      where: {
        task: {
          status: "AUCTION_ENDED",
        },
      },
      select: {
        id: true,
        endTime: true,
        taskId: true,
        group: {
          select: {
            id: true,
            depositPeriod: true,
          },
        },
        bidHistories: {
          where: {
            status: "WON",
          },
          select: {
            userId: true,
            depositPoint: true,
          },
        },
        task: {
          select: {
            id: true,
            task: true,
            status: true,
          },
        },
      },
    });

    // ポイント返還対象のオークションをフィルタリング
    const auctionsToProcess = targetAuctions.filter((auction) => {
      const depositEndDate = new Date(auction.endTime);
      depositEndDate.setDate(depositEndDate.getDate() + auction.group.depositPeriod);
      return depositEndDate <= now && auction.task.status === "AUCTION_ENDED";
    });

    console.log(`ポイント返還対象のオークション数: ${auctionsToProcess.length}件`);

    // 各オークションに対してポイント返還処理を実行
    let processedCount = 0;
    for (const auction of auctionsToProcess) {
      // 落札したユーザーのBidHistoryレコードがない場合はスキップ
      if (auction.bidHistories.length === 0) {
        console.log(`オークションID: ${auction.id} には落札者のレコードがありません。スキップします。`);
        continue;
      }

      // 落札者の情報を取得
      const winningBid = auction.bidHistories[0];
      if (winningBid.depositPoint == null || winningBid.depositPoint === undefined) {
        console.log(`オークションID: ${auction.id} の落札者の預けポイントがありません。スキップします。`);
        continue;
      }

      // depositPointの型を確定させる
      const depositPointAmount: number = winningBid.depositPoint;

      // トランザクション内でポイント返還と通知作成を実行
      await prisma.$transaction(async (tx) => {
        // 1. GroupPointテーブルのbalanceに預けたポイントを返還
        const updatedGroupPoint = await tx.groupPoint.updateMany({
          where: {
            userId: winningBid.userId,
            groupId: auction.group.id,
          },
          data: {
            balance: {
              increment: depositPointAmount,
            },
          },
        });

        if (updatedGroupPoint.count === 0) {
          throw new Error(`ユーザーID: ${winningBid.userId} のグループポイントレコードが見つかりませんでした。`);
        }

        console.log(`オークションID: ${auction.id} の落札者(${winningBid.userId})に ${depositPointAmount} ポイントを返還しました。`);

        // タスクのタイトルを取得
        const task = await tx.task.findUnique({
          where: { id: auction.taskId },
          select: { task: true },
        });

        if (!task) {
          throw new Error(`タスクID: ${auction.taskId} が見つかりませんでした。`);
        }

        // 2. 通知を送信
        await sendAuctionNotification({
          text: {
            first: task.task,
            second: String(depositPointAmount),
          },
          auctionEventType: "POINT_RETURNED",
          auctionId: auction.id,
          recipientUserId: [winningBid.userId],
          sendMethods: [NotificationSendMethod.WEB_PUSH, NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL],
          actionUrl: `/auction/${auction.id}`,
          sendTiming: NotificationSendTiming.NOW,
          sendScheduledDate: null,
          expiresAt: null,
        });
      });

      processedCount++;
    }

    console.log(`${processedCount}件のオークションのポイント返還処理が完了しました。`);
    return processedCount;
  } catch (error) {
    console.error("オークションポイント返還処理でエラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メイン関数
 */
export async function main() {
  try {
    console.log("オークションのポイント返還処理を開始します...");

    // ポイント返還処理を実行
    const processedCount = await returnAuctionDepositPoints();

    console.log(`処理が完了しました。${processedCount}件のオークションのポイント返還処理を実行しました。`);
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// スクリプト実行
// テスト環境では実行しない
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error("スクリプト実行中にエラーが発生しました:", error);
    process.exit(1);
  });
}
