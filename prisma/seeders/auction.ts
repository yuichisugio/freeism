import type { BidHistory } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker/locale/ja";
import { BidStatus, ContributionType, Prisma, ReviewPosition, TaskStatus } from "@prisma/client";

import type { SeedAuction, SeedTask, SeedUser } from "./types";
import { CATEGORY_DELIVERY_METHODS, DELIVERY_METHODS, PRESERVED_USER_IDS, SEED_CONFIG } from "./config";
import {
  createAuctionEndNotifications,
  createSellerNotification,
  generateNotificationMessage,
  generateNotificationTitle,
} from "./notification";

/**
 * オークションを生成する関数
 * @param tasks タスクの配列
 * @param users ユーザーの配列
 * @returns 生成されたオークションの配列
 */
export async function createAuctions(
  tasks: SeedTask[],
  users: SeedUser[],
  prisma: PrismaClient,
): Promise<SeedAuction[]> {
  console.log("Creating auctions...");

  const auctions: SeedAuction[] = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  // タスクから報酬タイプのタスクのみ抽出（contributionType が "REWARD" のもの）
  const rewardTasks = tasks.filter((task) => task.contributionType === ContributionType.REWARD);

  // 報酬タスクが少ない場合は、追加の報酬タスクを作成 (SEED_CONFIG の最小数まで)
  const minRewardTasks = SEED_CONFIG.MIN_REWARD_TASKS_FOR_AUCTION;
  if (rewardTasks.length < minRewardTasks) {
    console.log(
      `報酬タスクが少ないため(${rewardTasks.length}件)、NON_REWARDタスクから最大${minRewardTasks - rewardTasks.length}件を変換します`,
    );
    const nonRewardTasks = tasks.filter((task) => task.contributionType === ContributionType.NON_REWARD);
    const tasksToConvert = faker.helpers.arrayElements(
      nonRewardTasks,
      Math.min(nonRewardTasks.length, minRewardTasks - rewardTasks.length),
    );

    for (const task of tasksToConvert) {
      const category = task.category ?? "その他";
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] ?? DELIVERY_METHODS;
      const deliveryMethod = faker.helpers.arrayElement(categoryMethods);

      await prisma.task.update({
        where: { id: task.id },
        data: {
          contributionType: ContributionType.REWARD,
          deliveryMethod,
        },
      });
      rewardTasks.push({ ...task, contributionType: ContributionType.REWARD, deliveryMethod });
    }
  }

  for (const task of rewardTasks) {
    const now = new Date();
    const startTimeOffset = faker.number.int({
      min: SEED_CONFIG.AUCTION_START_TIME_MIN_DAYS_AGO * 24 * 60 * 60 * 1000,
      max: SEED_CONFIG.AUCTION_START_TIME_MAX_DAYS_AGO * 24 * 60 * 60 * 1000,
    });
    const startTime = new Date(now.getTime() + startTimeOffset);

    const endTimeOffset = faker.number.int({
      min: SEED_CONFIG.AUCTION_DURATION_MIN_DAYS * 24 * 60 * 60 * 1000,
      max: SEED_CONFIG.AUCTION_DURATION_MAX_DAYS * 24 * 60 * 60 * 1000,
    });
    const endTime = new Date(startTime.getTime() + endTimeOffset);

    const initialPrice = faker.number.int({
      min: SEED_CONFIG.AUCTION_INITIAL_PRICE_MIN,
      max: SEED_CONFIG.AUCTION_INITIAL_PRICE_MAX,
    });

    let status: TaskStatus;
    if (startTime > now) {
      status = TaskStatus.PENDING;
    } else if (endTime > now) {
      status = TaskStatus.AUCTION_ACTIVE;
    } else {
      status = TaskStatus.AUCTION_ENDED;
    }

    let currentHighestBid = initialPrice;
    let currentHighestBidderId = null;

    if (status === TaskStatus.AUCTION_ACTIVE || status === TaskStatus.AUCTION_ENDED) {
      const potentialBidders = users.filter((user) => user.id !== task.creatorId);
      const preservedBidders = potentialBidders.filter((user) => preservedUserIds.has(user.id));
      const otherBidders = potentialBidders.filter((user) => !preservedUserIds.has(user.id));

      if (potentialBidders.length > 0) {
        const hasBids = faker.datatype.boolean(SEED_CONFIG.AUCTION_HAS_BIDS_PROBABILITY);
        if (hasBids) {
          let highestBidder = null;
          if (
            preservedBidders.length > 0 &&
            faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_AUCTION_HIGHEST_BIDDER_PROBABILITY)
          ) {
            highestBidder = faker.helpers.arrayElement(preservedBidders);
          } else {
            highestBidder = faker.helpers.arrayElement(otherBidders.length > 0 ? otherBidders : potentialBidders);
          }
          currentHighestBidderId = highestBidder.id;

          const bidIncrease =
            initialPrice *
            (SEED_CONFIG.AUCTION_BID_INCREASE_MIN_PERCENT +
              faker.number.float({
                min: 0,
                max: SEED_CONFIG.AUCTION_BID_INCREASE_MAX_PERCENT - SEED_CONFIG.AUCTION_BID_INCREASE_MIN_PERCENT,
              }));
          currentHighestBid = Math.floor(initialPrice + bidIncrease);
        }
      }
    }

    let winnerId = null;
    if (status === TaskStatus.AUCTION_ENDED && currentHighestBidderId) {
      winnerId = currentHighestBidderId;
    }

    let deliveryMethod = task.deliveryMethod;
    if (!deliveryMethod) {
      const category = task.category ?? "その他";
      const categoryMethods = CATEGORY_DELIVERY_METHODS[category] ?? DELIVERY_METHODS;
      deliveryMethod = faker.helpers.arrayElement(categoryMethods);
      await prisma.task.update({
        where: { id: task.id },
        data: { deliveryMethod },
      });
    }

    // オークション延長設定を生成
    const isExtension = faker.datatype.boolean(SEED_CONFIG.AUCTION_EXTENSION_PROBABILITY);
    let extensionTotalCount = 0;
    let extensionTime = 0;

    // 延長制限回数と時間を設定（延長機能が有効な場合のみ有意味な値、無効でもデフォルト値を設定）
    const extensionLimitCount = isExtension
      ? faker.number.int({
          min: SEED_CONFIG.AUCTION_EXTENSION_LIMIT_COUNT_MIN,
          max: SEED_CONFIG.AUCTION_EXTENSION_LIMIT_COUNT_MAX,
        })
      : 3; // デフォルト値
    const extensionTimeLimit = isExtension
      ? faker.number.int({
          min: SEED_CONFIG.AUCTION_EXTENSION_LIMIT_TIME_MIN,
          max: SEED_CONFIG.AUCTION_EXTENSION_LIMIT_TIME_MAX,
        })
      : 10; // デフォルト値

    // 延長機能が有効な場合、実際に延長が発生したかをシミュレート
    if (isExtension) {
      const hasExtensionOccurred = faker.datatype.boolean(SEED_CONFIG.AUCTION_EXTENSION_OCCURRED_PROBABILITY);
      if (hasExtensionOccurred) {
        // 実際に延長が発生した回数（制限回数以下）
        extensionTotalCount = faker.number.int({ min: 1, max: extensionLimitCount });
        // 延長総時間は「延長回数 × 延長単位時間」
        extensionTime = extensionTotalCount * extensionTimeLimit;
      }
    }

    // AuctionCreateInputからstatusを削除
    const auctionDataForCreation: Prisma.AuctionCreateInput = {
      task: { connect: { id: task.id } },
      group: { connect: { id: task.groupId } },
      currentHighestBid,
      startTime,
      endTime,
      currentHighestBidder: currentHighestBidderId ? { connect: { id: currentHighestBidderId } } : undefined,
      winner: winnerId ? { connect: { id: winnerId } } : undefined,
      isExtension,
      extensionTotalCount,
      extensionLimitCount,
      extensionTime,
      remainingTimeForExtension: extensionTimeLimit,
    };

    const auction = await prisma.auction.create({
      data: auctionDataForCreation,
    });

    // statusはローカル変数で保持
    auctions.push({
      id: auction.id,
      taskId: task.id,
      startTime: auction.startTime,
      endTime: auction.endTime,
      currentHighestBid: auction.currentHighestBid,
      currentHighestBidderId: auction.currentHighestBidderId,
      winnerId: auction.winnerId,
      status, // TaskStatus型で保持
      isExtension,
      extensionTotalCount,
      extensionLimitCount,
      extensionTime,
      remainingTimeForExtension: extensionTimeLimit,
      createdAt: auction.createdAt,
      updatedAt: auction.updatedAt,
      groupId: task.groupId,
    });
  }

  console.log(`Created ${auctions.length} auctions`);
  return auctions;
}

/**
 * 入札履歴の生成
 * @param auctions オークションの配列
 * @param users ユーザーの配列
 * @param prisma Prismaクライアントインスタンス
 * @returns 生成された入札履歴の配列
 */
export async function createBidHistories(auctions: SeedAuction[], users: SeedUser[], prisma: PrismaClient) {
  console.log("Creating bid histories...");

  const bidHistories = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  for (const auction of auctions) {
    if (auction.status === TaskStatus.PENDING) continue;

    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });
    if (!task) continue;

    // オークションのグループメンバーシップを取得
    const groupMembers = await prisma.groupMembership.findMany({
      where: { groupId: auction.groupId },
      select: { userId: true },
    });
    const groupMemberIds = new Set(groupMembers.map((gm) => gm.userId));

    // 潜在的な入札者をグループメンバーかつタスク作成者でないユーザーに限定
    const potentialBidders = users.filter((user) => user.id !== task.creatorId && groupMemberIds.has(user.id));

    const preservedBidders = potentialBidders.filter((user) => preservedUserIds.has(user.id));
    const otherBidders = potentialBidders.filter((user) => !preservedUserIds.has(user.id));

    if (potentialBidders.length === 0) continue;

    const bidCount = faker.number.int({ min: SEED_CONFIG.BIDS_PER_AUCTION_MIN, max: SEED_CONFIG.BIDS_PER_AUCTION_MAX });

    // Fetch the initial price directly from the created auction record
    const dbAuction = await prisma.auction.findUnique({
      where: { id: auction.id },
      select: { startTime: true, endTime: true, currentHighestBid: true },
    });

    if (!dbAuction) {
      console.warn(`Auction ${auction.id} not found in DB for bid history creation.`);
      continue;
    }

    const initialPrice = dbAuction.currentHighestBid;
    let currentBid = initialPrice;

    const bidTimeRange = Math.max(0, dbAuction.endTime.getTime() - dbAuction.startTime.getTime());
    const bidTimes = Array(bidCount)
      .fill(0)
      .map(() => new Date(dbAuction.startTime.getTime() + faker.number.float() * bidTimeRange))
      .sort((a, b) => a.getTime() - b.getTime());

    const bidRecords: BidHistory[] = [];

    // 入札履歴を作成
    for (let i = 0; i < bidCount; i++) {
      let bidder = null;
      if (preservedBidders.length > 0 && faker.datatype.boolean(SEED_CONFIG.PRESERVED_USER_AS_BIDDER_PROBABILITY)) {
        bidder = faker.helpers.arrayElement(preservedBidders);
      } else {
        bidder = faker.helpers.arrayElement(otherBidders.length > 0 ? otherBidders : potentialBidders);
      }

      const bidIncrease =
        currentBid *
        (SEED_CONFIG.BID_INCREASE_MIN_PERCENT +
          faker.number.float({
            min: 0,
            max: SEED_CONFIG.BID_INCREASE_MAX_PERCENT - SEED_CONFIG.BID_INCREASE_MIN_PERCENT,
          }));
      currentBid = Math.max(initialPrice + 1, currentBid + 1, Math.floor(currentBid + bidIncrease));

      const isAutoBid = faker.datatype.boolean(SEED_CONFIG.BID_IS_AUTOBID_PROBABILITY);
      const bidStatus = BidStatus.BIDDING;

      try {
        const bid = await prisma.bidHistory.create({
          data: {
            auctionId: auction.id,
            userId: bidder.id,
            amount: currentBid,
            isAutoBid,
            createdAt: bidTimes[i],
            status: bidStatus,
          },
        });
        bidRecords.push(bid);
        bidHistories.push(bid);
      } catch (error) {
        console.error(`入札履歴作成エラー: AuctionID=${auction.id}, UserID=${bidder.id}`, error);
      }
    }

    // オークション終了後の処理
    if (auction.status === TaskStatus.AUCTION_ENDED) {
      await processEndedAuction(auction, bidRecords, prisma);
    } else if (auction.status === TaskStatus.AUCTION_ACTIVE && bidRecords.length > 0) {
      await processActiveAuction(auction, bidRecords, prisma);
    }
  }

  console.log(`Created ${bidHistories.length} bid histories`);
  return bidHistories;
}

/**
 * 終了したオークションの処理を別関数に分離
 * @param auction オークション
 * @param bidRecords 入札履歴の配列
 * @param prisma Prismaクライアントインスタンス
 */
async function processEndedAuction(auction: SeedAuction, bidRecords: BidHistory[], prisma: PrismaClient) {
  if (bidRecords.length === 0) {
    // 入札がない場合のタスクステータス更新
    const currentTask = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { status: true },
    });
    if (currentTask && currentTask.status === TaskStatus.PENDING) {
      await prisma.task.update({
        where: { id: auction.taskId },
        data: { status: TaskStatus.ARCHIVED },
      });
    }

    // 出品者への通知
    await createSellerNotification(auction, "NO_WINNER", prisma);
    await createSellerNotification(auction, "ENDED", prisma);
    return;
  }

  // 入札がある場合の処理
  const sortedBids = [...bidRecords].sort((a, b) => b.amount - a.amount);
  let winnerFound = false;
  let winnerId: string | null = null;

  // 最高入札者から順に落札者を決定
  for (let i = 0; i < sortedBids.length; i++) {
    const currentBid = sortedBids[i];
    const nextBid = i < sortedBids.length - 1 ? sortedBids[i + 1] : null;
    const depositAmount = nextBid ? nextBid.amount + 1 : currentBid.amount;

    const groupPoint = await prisma.groupPoint.findFirst({
      where: { userId: currentBid.userId, groupId: auction.groupId },
    });

    if (groupPoint && groupPoint.balance >= depositAmount) {
      // 落札者決定
      await processBidWinner(currentBid, depositAmount, auction, prisma);
      winnerId = currentBid.userId;
      winnerFound = true;
      break;
    } else {
      // 残高不足
      await prisma.bidHistory.update({
        where: { id: currentBid.id },
        data: { status: BidStatus.INSUFFICIENT },
      });
    }
  }

  // 残りの入札を敗者に設定
  await updateLosingBids(sortedBids, prisma);

  // タスクステータスの更新
  if (winnerFound) {
    await prisma.task.update({
      where: { id: auction.taskId },
      data: { status: TaskStatus.POINTS_DEPOSITED },
    });
  } else {
    const currentTask = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { status: true },
    });
    if (currentTask && currentTask.status === TaskStatus.PENDING) {
      await prisma.task.update({
        where: { id: auction.taskId },
        data: { status: TaskStatus.ARCHIVED },
      });
    }
  }

  // 通知の作成
  await createAuctionEndNotifications(auction, winnerFound, winnerId, sortedBids, prisma);
}

/**
 * 落札者の処理を別関数に分離
 * @param bid 入札
 * @param depositAmount 保証金額
 * @param auction オークション
 * @param prisma Prismaクライアントインスタンス
 */
async function processBidWinner(bid: BidHistory, depositAmount: number, auction: SeedAuction, prisma: PrismaClient) {
  await prisma.bidHistory.update({
    where: { id: bid.id },
    data: { status: BidStatus.WON, depositPoint: depositAmount },
  });

  await prisma.groupPoint.updateMany({
    where: { userId: bid.userId, groupId: auction.groupId },
    data: { balance: { decrement: depositAmount } },
  });

  await prisma.auction.update({
    where: { id: auction.id },
    data: { winnerId: bid.userId },
  });
}

/**
 * 敗者の更新を別関数に分離
 * @param sortedBids 入札履歴の配列
 * @param prisma Prismaクライアントインスタンス
 */
async function updateLosingBids(sortedBids: BidHistory[], prisma: PrismaClient) {
  for (const bid of sortedBids) {
    const latestBid = await prisma.bidHistory.findUnique({
      where: { id: bid.id },
      select: { status: true },
    });

    if (latestBid?.status === BidStatus.BIDDING) {
      await prisma.bidHistory.update({
        where: { id: bid.id },
        data: { status: BidStatus.LOST },
      });
    }
  }
}

/**
 * アクティブなオークションの処理を別関数に分離
 * @param auction オークション
 * @param bidRecords 入札履歴の配列
 * @param prisma Prismaクライアントインスタンス
 */
async function processActiveAuction(auction: SeedAuction, bidRecords: BidHistory[], prisma: PrismaClient) {
  const sortedBids = [...bidRecords].sort((a, b) => b.amount - a.amount);
  const highestBid = sortedBids[0];

  if (highestBid) {
    try {
      const currentDbAuction = await prisma.auction.findUnique({
        where: { id: auction.id },
        select: { currentHighestBid: true },
      });

      if (currentDbAuction && highestBid.amount > currentDbAuction.currentHighestBid) {
        await prisma.auction.update({
          where: { id: auction.id },
          data: {
            currentHighestBid: highestBid.amount,
            currentHighestBidderId: highestBid.userId,
          },
        });
      }
    } catch (error) {
      console.error(`オークション最高入札額更新エラー: AuctionID=${auction.id}`, error);
    }
  }
}

/**
 * 自動入札設定の生成
 * @param auctions オークションの配列
 * @param users ユーザーの配列
 * @param prisma Prismaクライアントインスタンス
 * @returns 生成された自動入札設定の配列
 */
export async function createAutoBids(auctions: SeedAuction[], users: SeedUser[], prisma: PrismaClient) {
  console.log("Creating auto bids...");

  const autoBids = [];

  // アクティブなオークションのみを対象
  const activeAuctions = auctions.filter((auction) => auction.status === TaskStatus.AUCTION_ACTIVE);

  for (const auction of activeAuctions) {
    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // タスク作成者以外のユーザーを候補として抽出
    const potentialUsers = users.filter((user) => user.id !== task.creatorId);
    const preservedUsersForAutoBid = potentialUsers.filter((user) => PRESERVED_USER_IDS.includes(user.id));
    const otherUsersForAutoBid = potentialUsers.filter((user) => !PRESERVED_USER_IDS.includes(user.id));

    if (potentialUsers.length === 0) continue;

    // 自動入札設定を持つユーザー数（指定範囲）
    const autoBidUserCount = faker.number.int({
      min: SEED_CONFIG.AUTOBIDS_PER_AUCTION_MIN,
      max: SEED_CONFIG.AUTOBIDS_PER_AUCTION_MAX,
    });
    if (autoBidUserCount === 0) continue;

    // ランダムにユーザーを選択（保持ユーザーを優先）
    const autoBidUsers = faker.helpers.arrayElements(
      preservedUsersForAutoBid.length > 0 ? preservedUsersForAutoBid : otherUsersForAutoBid,
      Math.min(autoBidUserCount, potentialUsers.length), // 候補者数を超えないように
    );

    for (const user of autoBidUsers) {
      // 自動入札の最大金額は現在の最高入札額の指定%増し
      // Linter Fix: Add closing parenthesis
      const maxBidAmount = Math.floor(
        auction.currentHighestBid *
          (SEED_CONFIG.AUTOBID_MAX_INCREASE_MIN_PERCENT +
            faker.number.float({
              min: 0,
              max: SEED_CONFIG.AUTOBID_MAX_INCREASE_MAX_PERCENT - SEED_CONFIG.AUTOBID_MAX_INCREASE_MIN_PERCENT,
            })),
      );
      // 入札単位は指定範囲でランダム
      const bidIncrement = faker.number.int({
        min: SEED_CONFIG.AUTOBID_INCREMENT_MIN,
        max: SEED_CONFIG.AUTOBID_INCREMENT_MAX,
      });

      try {
        const autoBid = await prisma.autoBid.create({
          data: {
            user: { connect: { id: user.id } },
            auction: { connect: { id: auction.id } },
            maxBidAmount,
            bidIncrement,
            isActive: true,
            lastBidTime: new Date(new Date().getTime() - faker.number.int({ min: 1, max: 24 }) * 60 * 60 * 1000),
          },
        });

        autoBids.push(autoBid);
      } catch (error) {
        console.error("自動入札設定作成エラー:", error);
      }
    }
  }

  console.log(`Created ${autoBids.length} auto bids`);
  return autoBids;
}

/**
 * オークションレビューの生成
 * @param auctions オークションの配列
 * @param prisma Prismaクライアントインスタンス
 * @returns 生成されたオークションレビューの配列
 */
export async function createAuctionReviews(auctions: SeedAuction[], prisma: PrismaClient) {
  console.log("Creating auction reviews...");

  const reviews = [];

  // 終了したオークションのみを対象
  const endedAuctions = auctions.filter(
    (auction) => auction.status === TaskStatus.AUCTION_ENDED && auction.winnerId !== null,
  );

  // 完了証明URLのパターン
  const proofUrlPatterns = [
    "https://example.com/proof/",
    "https://img-service.com/completion/",
    "https://storage.googleapis.com/proof-images/",
    null, // 証明なしのケース
  ];

  for (const auction of endedAuctions) {
    // 関連するタスクを取得
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });

    if (!task) continue;

    // レビューが存在する確率（SEED_CONFIG の確率）
    const hasReview = faker.datatype.boolean(SEED_CONFIG.AUCTION_REVIEW_PROBABILITY);
    if (!hasReview) continue;

    // 売り手（タスク作成者）から買い手（落札者）へのレビュー
    try {
      // 完了証明URLの生成（指定確率で存在）
      const hasProofUrl = faker.datatype.boolean(SEED_CONFIG.AUCTION_PROOF_URL_PROBABILITY);
      const proofUrlBase = hasProofUrl ? faker.helpers.arrayElement(proofUrlPatterns.filter(Boolean)) : null;
      const completionProofUrl = proofUrlBase ? `${proofUrlBase}${faker.string.uuid()}.jpg` : null;

      const sellerReviewComments = [
        "とても良い取引相手でした。スムーズに取引が完了しました。",
        "迅速な対応に感謝します。また機会があれば取引したいです。",
        "丁寧な対応でした。約束通りの取引ができました。",
        "問題なく取引できました。信頼できる相手です。",
        "コミュニケーションが円滑で、理解力の高い方でした。",
        "非常に協力的で、取引がとてもスムーズでした。",
        "また取引したいです。とても満足しています。",
      ];

      const sellerReview = await prisma.auctionReview.create({
        data: {
          auction: { connect: { id: auction.id } },
          reviewer: { connect: { id: task.creatorId } },
          reviewee: { connect: { id: auction.winnerId! } }, // winnerIdが確実に存在することを型アサーションで保証
          rating: faker.number.int({
            min: SEED_CONFIG.AUCTION_SELLER_REVIEW_RATING_MIN,
            max: SEED_CONFIG.AUCTION_SELLER_REVIEW_RATING_MAX,
          }), // 売り手からは比較的高評価
          comment: faker.helpers.arrayElement(sellerReviewComments),
          completionProofUrl,
          // isSellerReview: true, // isSellerReview: true から変更
          reviewPosition: ReviewPosition.SELLER_TO_BUYER,
          createdAt: new Date(auction.endTime.getTime() + faker.number.int({ min: 1, max: 7 * 24 }) * 60 * 60 * 1000),
        },
      });

      reviews.push(sellerReview);
    } catch (error) {
      console.error("売り手レビュー作成エラー:", error);
    }

    // 買い手から売り手へのレビュー（指定確率で存在）
    const hasBuyerToSellerReview = faker.datatype.boolean(SEED_CONFIG.AUCTION_BUYER_TO_SELLER_REVIEW_PROBABILITY);
    if (hasBuyerToSellerReview) {
      try {
        // 完了証明URLの生成（指定確率で存在）
        const hasProofUrl = faker.datatype.boolean(SEED_CONFIG.AUCTION_PROOF_URL_PROBABILITY);
        const proofUrlBase = hasProofUrl ? faker.helpers.arrayElement(proofUrlPatterns.filter(Boolean)) : null;
        const completionProofUrl = proofUrlBase ? `${proofUrlBase}${faker.string.uuid()}.jpg` : null;

        const buyerReviewComments = [
          "商品の状態が良く、満足しています。",
          "丁寧な梱包で安心しました。",
          "説明通りの商品でした。",
          "また利用したいです。対応が迅速でとても良かったです。",
          "迅速な発送に感謝します。良い取引ができました。",
          "期待以上の内容でした。とても満足しています。",
          "正確な情報提供に感謝します。",
          "次回も機会があれば取引したいです。",
        ];

        const buyerReview = await prisma.auctionReview.create({
          data: {
            auction: { connect: { id: auction.id } },
            reviewer: { connect: { id: auction.winnerId! } }, // winnerIdが確実に存在することを型アサーションで保証
            reviewee: { connect: { id: task.creatorId } },
            rating: faker.number.int({
              min: SEED_CONFIG.AUCTION_BUYER_REVIEW_RATING_MIN,
              max: SEED_CONFIG.AUCTION_BUYER_REVIEW_RATING_MAX,
            }), // 買い手からの評価は若干ばらつきがある
            comment: faker.helpers.arrayElement(buyerReviewComments),
            completionProofUrl,
            // isSellerReview: false, // isSellerReview: false から変更
            reviewPosition: ReviewPosition.BUYER_TO_SELLER,
            createdAt: new Date(auction.endTime.getTime() + faker.number.int({ min: 1, max: 7 * 24 }) * 60 * 60 * 1000),
          },
        });

        reviews.push(buyerReview);
      } catch (error) {
        console.error("買い手レビュー作成エラー:", error);
      }
    }
  }

  console.log(`Created ${reviews.length} auction reviews`);
  return reviews;
}

/**
 * オークションのウォッチリスト生成
 * @param auctions オークションの配列
 * @param users ユーザーの配列
 * @param prisma Prismaクライアントインスタンス
 * @returns 生成されたウォッチリストの配列
 */
export async function createTaskWatchLists(auctions: SeedAuction[], users: SeedUser[], prisma: PrismaClient) {
  console.log("Creating task watch lists...");

  const watchLists = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  for (const auction of auctions) {
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });
    if (!task) continue;

    // ウォッチ候補者 (タスク作成者以外)
    const potentialWatchers = users.filter((user) => user.id !== task.creatorId);
    const preservedWatchers = potentialWatchers.filter((user) => preservedUserIds.has(user.id));
    const otherWatchers = potentialWatchers.filter((user) => !preservedUserIds.has(user.id));

    if (potentialWatchers.length === 0) continue;

    const watcherCount = faker.number.int({
      min: SEED_CONFIG.WATCHLISTS_PER_AUCTION_MIN,
      max: SEED_CONFIG.WATCHLISTS_PER_AUCTION_MAX,
    });
    if (watcherCount === 0) continue;

    // ウォッチするユーザーを選択 (保持ユーザーを優先、例: 60%の確率)
    const PRESERVED_WATCHER_PROBABILITY = 0.6;
    const watchers = [];
    const selectedUserIds = new Set<string>();

    for (let i = 0; i < watcherCount && potentialWatchers.length > selectedUserIds.size; i++) {
      let userToSelect: SeedUser | null = null;
      const availablePreserved = preservedWatchers.filter((u) => !selectedUserIds.has(u.id));
      const availableOthers = otherWatchers.filter((u) => !selectedUserIds.has(u.id));
      const availableAll = potentialWatchers.filter((u) => !selectedUserIds.has(u.id));

      if (availablePreserved.length > 0 && faker.datatype.boolean(PRESERVED_WATCHER_PROBABILITY)) {
        userToSelect = faker.helpers.arrayElement(availablePreserved);
      } else if (availableOthers.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableOthers);
      } else if (availableAll.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableAll);
      }

      if (userToSelect) {
        watchers.push(userToSelect);
        selectedUserIds.add(userToSelect.id);
      } else {
        break; // 候補者がいなくなったら終了
      }
    }

    for (const watcher of watchers) {
      try {
        const createdAtTime = faker.date.between({ from: auction.createdAt, to: new Date() });

        const watchList = await prisma.taskWatchList.create({
          data: {
            userId: watcher.id,
            auctionId: auction.id,
            createdAt: createdAtTime,
          },
        });
        watchLists.push(watchList);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          console.warn(`ウォッチリスト重複: UserID=${watcher.id}, AuctionID=${auction.id}`);
        } else {
          console.error("ウォッチリスト作成エラー:", error);
        }
      }
    }
  }

  console.log(`Created ${watchLists.length} watch list entries`);
  return watchLists;
}

/**
 * オークションメッセージの生成
 * @param auctions オークションの配列
 * @param users ユーザーの配列
 * @param prisma Prismaクライアントインスタンス
 * @returns 生成されたオークションメッセージの配列
 */
export async function createAuctionMessages(auctions: SeedAuction[], users: SeedUser[], prisma: PrismaClient) {
  console.log("Creating auction messages...");

  const messages = [];
  const preservedUserIds = new Set(PRESERVED_USER_IDS);

  const targetAuctions = auctions.filter(
    (auction) => auction.status === TaskStatus.AUCTION_ACTIVE || auction.status === TaskStatus.AUCTION_ENDED,
  );

  for (const auction of targetAuctions) {
    const task = await prisma.task.findUnique({
      where: { id: auction.taskId },
      select: { creatorId: true },
    });
    if (!task) continue;
    const sellerId = task.creatorId;

    // メッセージ相手の候補 (出品者以外)
    const potentialPartners = users.filter((user) => user.id !== sellerId);
    const preservedPartners = potentialPartners.filter((user) => preservedUserIds.has(user.id));
    const otherPartners = potentialPartners.filter((user) => !preservedUserIds.has(user.id));

    if (potentialPartners.length === 0) continue;

    // メッセージをやりとりする相手を最大2人選ぶ (保持ユーザーを優先、例: 50%)
    const partnerCount = Math.min(2, potentialPartners.length);
    const partners = [];
    const selectedUserIds = new Set<string>();
    const PRESERVED_PARTNER_PROBABILITY = 0.5;

    for (let i = 0; i < partnerCount && potentialPartners.length > selectedUserIds.size; i++) {
      let userToSelect: SeedUser | null = null;
      const availablePreserved = preservedPartners.filter((u) => !selectedUserIds.has(u.id));
      const availableOthers = otherPartners.filter((u) => !selectedUserIds.has(u.id));
      const availableAll = potentialPartners.filter((u) => !selectedUserIds.has(u.id));

      if (availablePreserved.length > 0 && faker.datatype.boolean(PRESERVED_PARTNER_PROBABILITY)) {
        userToSelect = faker.helpers.arrayElement(availablePreserved);
      } else if (availableOthers.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableOthers);
      } else if (availableAll.length > 0) {
        userToSelect = faker.helpers.arrayElement(availableAll);
      }

      if (userToSelect) {
        partners.push(userToSelect);
        selectedUserIds.add(userToSelect.id);
      } else {
        break;
      }
    }

    // 各相手とメッセージをやり取り
    for (const partner of partners) {
      // partner は入札者または質問者
      // 質問リストと回答リストを定義 (以前のコードから)
      const bidderQuestionList = [
        "こちらの商品の状態について教えていただけますか？",
        "発送方法や配送にかかる日数はどれくらいでしょうか？",
        "他にも同様の商品を出品予定はありますか？",
        "この商品のサイズや重さなど、詳細を教えていただけますか？",
        "保証やサポートはありますか？",
        "商品の使用歴について教えていただけますか？",
        "支払いが完了した後、いつ頃発送される予定ですか？",
        "色や素材についてより詳しい情報はありますか？",
      ];
      const sellerAnswerList = [
        "商品は新品同様の状態です。目立った傷や汚れはありません。",
        "発送は落札後2-3営業日以内に行います。配送方法は商品説明に記載の通りです。",
        "現在のところ、同様の商品の出品予定はありません。",
        "詳細な情報は商品説明に記載していますが、不明点があればお気軽にお尋ねください。",
        "はい、メーカー保証が残っています。詳細は商品到着後にお伝えします。",
        "商品は数回使用しただけで、ほぼ新品の状態です。",
        "ご入金確認後、すぐに発送手続きを行います。通常は1-2営業日以内の発送となります。",
        "もちろんです。商品は黒色で素材は高品質なアルミニウムを使用しています。",
      ];

      try {
        const now = new Date();
        const messageBaseTime = faker.date.between({ from: auction.createdAt, to: now });

        // 1往復目
        const q1Time = faker.date.soon({ refDate: messageBaseTime, days: 1 });
        const bidderQuestion1 = await prisma.auctionMessage.create({
          data: {
            message: faker.helpers.arrayElement(bidderQuestionList),
            auctionId: auction.id,
            senderId: partner.id,
            createdAt: q1Time,
          },
        });
        messages.push(bidderQuestion1);

        const a1Time = faker.date.soon({ refDate: q1Time, days: 1 });
        const sellerAnswer1 = await prisma.auctionMessage.create({
          data: {
            message: faker.helpers.arrayElement(sellerAnswerList),
            auctionId: auction.id,
            senderId: sellerId,
            createdAt: a1Time,
          },
        });
        messages.push(sellerAnswer1);

        // 2往復目 (確率で発生)
        if (faker.datatype.boolean(0.7)) {
          const q2Time = faker.date.soon({ refDate: a1Time, days: 1 });
          const bidderQuestion2 = await prisma.auctionMessage.create({
            data: {
              message: faker.helpers.arrayElement(bidderQuestionList.filter((m) => m !== bidderQuestion1.message)),
              auctionId: auction.id,
              senderId: partner.id,
              createdAt: q2Time,
            },
          });
          messages.push(bidderQuestion2);

          const a2Time = faker.date.soon({ refDate: q2Time, days: 1 });
          const sellerAnswer2 = await prisma.auctionMessage.create({
            data: {
              message: faker.helpers.arrayElement(sellerAnswerList.filter((m) => m !== sellerAnswer1.message)),
              auctionId: auction.id,
              senderId: sellerId,
              createdAt: a2Time,
            },
          });
          messages.push(sellerAnswer2);
        }
      } catch (error) {
        console.error("オークションメッセージ作成エラー:", error);
      }
    }
  }

  console.log(`Created ${messages.length} auction messages`);
  return messages;
}

/**
 * ポイント返還処理のシミュレーション
 * 仕様書: オークション終了後、Group.depositPeriod日数後にポイントを返還
 * @param auctions 終了したオークション
 * @param prisma Prismaクライアントインスタンス
 * @returns 返還されたポイントの配列
 */
export async function simulatePointReturn(auctions: SeedAuction[], prisma: PrismaClient) {
  console.log("Simulating point return process...");

  const returnedPoints = [];
  const now = new Date();

  // 終了済みのオークションのみを対象に
  const endedAuctions = auctions.filter((auction) => auction.status === TaskStatus.AUCTION_ENDED && auction.winnerId);

  for (const auction of endedAuctions) {
    try {
      // グループの保管期間を取得
      const group = await prisma.group.findUnique({
        where: { id: auction.groupId },
        select: { depositPeriod: true },
      });

      if (!group) continue;

      // オークション終了日 + 保管期間が今日より前の場合、ポイント返還
      const returnDate = new Date(auction.endTime);
      returnDate.setDate(returnDate.getDate() + group.depositPeriod);

      // 一部のオークションで返還済みにするためにランダムフラグを使用
      const shouldReturn = faker.datatype.boolean(0.5); // 50%の確率で返還済みに

      if (shouldReturn && returnDate <= now && auction.winnerId) {
        // 落札履歴から入札額を取得
        const winningBid = await prisma.bidHistory.findFirst({
          where: {
            auctionId: auction.id,
            userId: auction.winnerId,
            status: BidStatus.WON,
          },
        });

        if (winningBid?.depositPoint) {
          // グループポイントを取得して更新
          const groupPoint = await prisma.groupPoint.findFirst({
            where: {
              userId: auction.winnerId,
              groupId: auction.groupId,
            },
          });

          if (groupPoint) {
            // ポイント返還処理
            await prisma.groupPoint.update({
              where: { id: groupPoint.id },
              data: {
                balance: {
                  increment: winningBid.depositPoint,
                },
              },
            });

            // タスク情報を取得
            const task = await prisma.task.findUnique({
              where: { id: auction.taskId },
              select: { task: true, deliveryMethod: true },
            });

            // ポイント返還通知を作成
            await prisma.notification.create({
              data: {
                title: generateNotificationTitle("POINT_RETURNED"),
                message: generateNotificationMessage(
                  "POINT_RETURNED",
                  auction,
                  { task: task?.task ?? "", deliveryMethod: task?.deliveryMethod, groupId: auction.groupId },
                  returnDate,
                ),
                targetType: "AUCTION_BIDDER",
                sendTimingType: "NOW", // 即時送信
                auctionEventType: "POINT_RETURNED",
                sendMethods: ["IN_APP"],
                senderUserId: null,
                auctionId: auction.id,
                isRead: { [auction.winnerId]: { isRead: false, readAt: null } }, // 修正: winnerId を使用して既読状態を設定
              },
            });

            returnedPoints.push({
              auctionId: auction.id,
              userId: auction.winnerId,
              amount: winningBid.depositPoint,
              returnDate,
            });
          }
        }
      }
    } catch (error) {
      console.error("ポイント返還処理エラー:", error);
    }
  }

  console.log(`Simulated ${returnedPoints.length} point returns`);
  return returnedPoints;
}
