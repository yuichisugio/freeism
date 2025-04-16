#!/usr/bin/env node
/**
 * オークションの完了処理を行うスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { AuctionStatus, BidStatus, TaskStatus, NotificationSendTiming, AuctionEventType, NotificationSendMethod } = require("@prisma/client");
const { sendAuctionNotification } = require("../src/lib/actions/notification/auction-notification.ts");

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションの完了処理を行う
 * endTimeが現在日時以前かつstatusがACTIVEまたはPENDINGのオークションを処理する
 *
 * @returns 処理されたオークションの数
 */
async function updateAuctionStatusToCompleted() {
  try {
    // 現在の日時を取得
    const now = new Date();

    // 処理対象のオークションを取得
    // endTimeが現在日時以前かつstatusがACTIVEまたはPENDINGのオークション
    const auctions = await prisma.auction.findMany({
      where: {
        endTime: {
          lte: now,
        },
        status: {
          in: [AuctionStatus.ACTIVE, AuctionStatus.PENDING],
        },
      },
      include: {
        task: true,
        group: true,
        bidHistories: {
          include: {
            user: true,
          },
          orderBy: {
            amount: "desc",
          },
        },
      },
    });

    console.log(`処理対象のオークション: ${auctions.length}件`);

    // 処理したオークションの数
    let processedCount = 0;

    // 各オークションに対して処理
    for (const auction of auctions) {
      try {
        // トランザクションを開始
        await prisma.$transaction(async (tx) => {
          // 入札履歴があるかチェック
          if (auction.bidHistories.length === 0) {
            // 入札がない場合の処理
            await handleAuctionWithNoBids(tx, auction);
          } else {
            // 入札がある場合の処理
            await handleAuctionWithBids(tx, auction);
          }
        });

        processedCount++;
        console.log(`オークション(ID: ${auction.id})の処理完了`);
      } catch (error) {
        console.error(`オークション(ID: ${auction.id})の処理中にエラーが発生:`, error);
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
 * @param {Object} tx トランザクションオブジェクト
 * @param {Object} auction オークションオブジェクト
 */
async function handleAuctionWithNoBids(tx, auction) {
  // オークションのステータスを更新
  await tx.auction.update({
    where: { id: auction.id },
    data: { status: AuctionStatus.ENDED },
  });

  // タスクのステータスは変更しない（報酬なしタスクの場合）

  // オークション詳細ページのURL
  const actionUrl = `/auctions/${auction.id}`;

  // 出品者への通知（オークション終了）
  await sendNotification({
    auctionId: auction.id,
    auctionEventType: AuctionEventType.ENDED,
    text: {
      first: auction.task.task,
      second: auction.task.task,
    },
    recipientUserId: await getTaskCreatorId(tx, auction),
    actionUrl: actionUrl,
  });

  // 出品者への通知（落札者なし）
  await sendNotification({
    auctionId: auction.id,
    auctionEventType: AuctionEventType.NO_WINNER,
    text: {
      first: auction.task.task,
      second: auction.task.task,
    },
    recipientUserId: await getTaskCreatorId(tx, auction),
    actionUrl: actionUrl,
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 入札があるオークションの処理
 * @param {Object} tx トランザクションオブジェクト
 * @param {Object} auction オークションオブジェクト
 */
async function handleAuctionWithBids(tx, auction) {
  // 有効な入札（BIDDING状態）のみを抽出し、金額の降順で並べる
  const validBids = auction.bidHistories.filter((bid) => bid.status === BidStatus.BIDDING).sort((a, b) => b.amount - a.amount);

  if (validBids.length === 0) {
    // 有効な入札がない場合は入札なしと同じ処理
    await handleAuctionWithNoBids(tx, auction);
    return;
  }

  // 最高額の入札者（落札候補者）
  let winnerBid = validBids[0];
  let winnerUser = winnerBid.user;
  let depositAmount;

  // 落札金額の決定
  if (validBids.length === 1) {
    // 入札者が1人のみの場合は、depositPointが0
    depositAmount = 0;
  } else {
    // 入札者が複数の場合、次点+1ポイントが落札額
    depositAmount = validBids[1].amount + 1;
  }

  // 落札者のポイント残高を確認
  const winnerGroupPoint = await tx.groupPoint.findUnique({
    where: {
      userId_groupId: {
        userId: winnerUser.id,
        groupId: auction.groupId,
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ポイント残高が不足している場合、次の入札者を試す
  if (!winnerGroupPoint || winnerGroupPoint.balance < depositAmount) {
    // 現在の最高入札者のステータスをINSUFFICIENTに更新
    await tx.bidHistory.update({
      where: { id: winnerBid.id },
      data: { status: BidStatus.INSUFFICIENT },
    });

    // 次の入札者で再試行
    const remainingBids = validBids.slice(1);
    if (remainingBids.length > 0) {
      // 更新されたオークションを再取得
      const updatedAuction = await tx.auction.findUnique({
        where: { id: auction.id },
        include: {
          task: true,
          group: true,
          bidHistories: {
            include: {
              user: true,
            },
          },
        },
      });

      // 残りの入札で再処理
      updatedAuction.bidHistories = remainingBids;
      await handleAuctionWithBids(tx, updatedAuction);
      return;
    } else {
      // 有効な入札者がいなくなった場合
      await handleAuctionWithNoBids(tx, auction);
      return;
    }
  }

  // ポイントを差し引く
  await tx.groupPoint.update({
    where: {
      userId_groupId: {
        userId: winnerUser.id,
        groupId: auction.groupId,
      },
    },
    data: {
      balance: {
        decrement: depositAmount,
      },
    },
  });

  // 落札した入札のdepositPointを更新
  await tx.bidHistory.update({
    where: { id: winnerBid.id },
    data: {
      status: BidStatus.WON,
      depositPoint: depositAmount,
    },
  });

  // 他の入札ステータスをLOSTに更新（INSUFFICIENTを除く）
  await tx.bidHistory.updateMany({
    where: {
      auctionId: auction.id,
      status: BidStatus.BIDDING,
      id: { not: winnerBid.id },
    },
    data: {
      status: BidStatus.LOST,
    },
  });

  // オークションのステータスとウィナーを更新
  await tx.auction.update({
    where: { id: auction.id },
    data: {
      status: AuctionStatus.ENDED,
      winnerId: winnerUser.id,
    },
  });

  // タスクのステータスを更新
  await tx.task.update({
    where: { id: auction.taskId },
    data: {
      status: TaskStatus.POINTS_DEPOSITED,
    },
  });

  // オークション詳細ページのURL
  const actionUrl = `/auctions/${auction.id}`;

  // 出品者への通知（オークション終了）
  await sendNotification({
    auctionId: auction.id,
    auctionEventType: AuctionEventType.ENDED,
    text: {
      first: auction.task.task,
      second: auction.task.task,
    },
    recipientUserId: await getTaskCreatorId(tx, auction),
    actionUrl: actionUrl,
  });

  // 出品者への通知（商品落札）
  await sendNotification({
    auctionId: auction.id,
    auctionEventType: AuctionEventType.ITEM_SOLD,
    text: {
      first: auction.task.task,
      second: auction.task.task,
    },
    recipientUserId: await getTaskCreatorId(tx, auction),
    actionUrl: actionUrl,
  });

  // 落札者への通知
  await sendNotification({
    auctionId: auction.id,
    auctionEventType: AuctionEventType.AUCTION_WIN,
    text: {
      first: auction.task.task,
      second: auction.task.task,
    },
    recipientUserId: [winnerUser.id],
    actionUrl: actionUrl,
  });

  // 落札できなかった入札者への通知
  for (const bid of validBids) {
    if (bid.id !== winnerBid.id && bid.status !== BidStatus.INSUFFICIENT) {
      await sendNotification({
        auctionId: auction.id,
        auctionEventType: AuctionEventType.AUCTION_LOST,
        text: {
          first: auction.task.task,
          second: auction.task.task,
        },
        recipientUserId: [bid.userId],
        actionUrl: actionUrl,
      });
    }
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成者のIDを取得する
 * @param {Object} tx トランザクションオブジェクト
 * @param {Object} auction オークションオブジェクト
 * @returns {Promise<string[]>} タスク作成者ID（配列形式）
 */
async function getTaskCreatorId(tx, auction) {
  const taskCreator = await tx.task.findUnique({
    where: { id: auction.taskId },
    select: { creatorId: true },
  });

  return taskCreator ? [taskCreator.creatorId] : [];
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * auction-notification.tsのsendAuctionNotificationを使用して通知を送信する
 * @param {Object} params 通知パラメータ
 */
async function sendNotification(params) {
  const { auctionId, auctionEventType, text, recipientUserId, actionUrl } = params;

  if (!recipientUserId || recipientUserId.length === 0) {
    console.log(`通知送信をスキップします: 受信者IDがありません。イベントタイプ: ${auctionEventType}`);
    return;
  }

  try {
    // sendAuctionNotificationを呼び出し
    const notificationParams = {
      text: text,
      auctionEventType: auctionEventType,
      auctionId: auctionId,
      recipientUserId: recipientUserId,
      sendMethod: [NotificationSendMethod.IN_APP, NotificationSendMethod.EMAIL, NotificationSendMethod.WEB_PUSH],
      actionUrl: actionUrl || null,
      sendTiming: NotificationSendTiming.NOW,
      sendScheduledDate: null,
      expiresAt: null,
    };

    const result = await sendAuctionNotification(notificationParams);

    if (result.success) {
      console.log(`通知を送信しました: イベントタイプ ${auctionEventType}, 受信者 ${recipientUserId.join(", ")}`);
    } else {
      console.error(`通知送信に失敗しました: ${result.error}`);
    }
  } catch (error) {
    console.error(`通知送信中にエラーが発生しました:`, error);
    console.error(error.stack);
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

// スクリプト実行
main();
