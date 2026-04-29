import { PrismaClient } from "@prisma/client";

import { createAnalytics } from "./seeders/analytics";
import {
  createAuctionMessages,
  createAuctionReviews,
  createAuctions,
  createAutoBids,
  createBidHistories,
  createTaskWatchLists,
  simulatePointReturn,
} from "./seeders/auction";
import { cleanupDatabase } from "./seeders/cleanup";
import { SEED_CONFIG } from "./seeders/config";
import { createGroupPoints, createGroups } from "./seeders/group";
import { createAuctionNotifications, createNotifications } from "./seeders/notification";
import { createTasks } from "./seeders/task";
import {
  createAccounts,
  createSessions,
  createUsers,
  createUserSettings,
  createVerificationTokens,
} from "./seeders/user";

// Prismaクライアントのインスタンス化
const prisma = new PrismaClient();

/**
 * メイン関数
 * シードデータを生成する全体の流れを制御します
 */
async function main() {
  try {
    console.log("シードデータの作成を開始します...");

    // 1. データベースの初期化
    await cleanupDatabase();

    // 2. ユーザー関連データの作成
    const users = await createUsers(SEED_CONFIG.USERS_COUNT);
    const accounts = await createAccounts(users);
    const sessions = await createSessions(users);
    const verificationTokens = await createVerificationTokens(SEED_CONFIG.VERIFICATION_TOKENS_COUNT);
    const userSettings = await createUserSettings(users);

    // 3. グループ関連データの作成
    const { groups, groupMemberships } = await createGroups(users);

    // 4. タスクデータの作成
    const tasks = await createTasks(SEED_CONFIG.TASKS_COUNT, groupMemberships, users);

    // 5. 分析データの作成
    const analytics = await createAnalytics(tasks, users);

    // 6. 通知データの作成
    const notifications = await createNotifications(users, groups, tasks, groupMemberships, prisma);

    // 7. オークション関連データの作成
    const auctions = await createAuctions(tasks, users, prisma);
    const bidHistories = await createBidHistories(auctions, users, prisma);
    const auctionMessages = await createAuctionMessages(auctions, users, prisma);
    const autoBids = await createAutoBids(auctions, users, prisma);
    const watchLists = await createTaskWatchLists(auctions, users, prisma);
    const auctionNotifications = await createAuctionNotifications(auctions, users, prisma);
    const auctionReviews = await createAuctionReviews(auctions, prisma);

    // 8. グループポイントデータの作成
    const groupPoints = await createGroupPoints();

    // 9. ポイント返還処理のシミュレーション
    const returnedPoints = await simulatePointReturn(auctions, prisma);

    // 10. 統計情報の表示
    console.log("-------------------------------------");
    console.log("シードデータ作成完了！");
    console.log("-------------------------------------");
    console.log(`ユーザー: ${users.length}名`);
    console.log(`アカウント: ${accounts.length}件`);
    console.log(`セッション: ${sessions.length}件`);
    console.log(`認証トークン: ${verificationTokens.length}件`);
    console.log(`ユーザー設定: ${userSettings.length}件`);
    console.log(`グループ: ${groups.length}件`);
    console.log(`グループメンバーシップ: ${groupMemberships.length}件`);
    console.log(`タスク: ${tasks.length}件`);
    console.log(`分析データ: ${analytics.length}件`);
    console.log(`通知: ${notifications.length + auctionNotifications.length}件`);
    console.log(`オークション: ${auctions.length}件`);
    console.log(`入札履歴: ${bidHistories.length}件`);
    console.log(`オークションメッセージ: ${auctionMessages.length}件`);
    console.log(`自動入札設定: ${autoBids.length}件`);
    console.log(`ウォッチリスト: ${watchLists.length}件`);
    console.log(`オークションレビュー: ${auctionReviews.length}件`);
    console.log(`グループポイント: ${groupPoints.length}件`);
    console.log(`ポイント返還: ${returnedPoints.length}件`);
    console.log("-------------------------------------");
  } catch (error) {
    console.error("シード作成エラー:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// プログラム実行
void main();
