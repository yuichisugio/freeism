import { PrismaClient } from "@prisma/client";

import { PRESERVED_USER_IDS } from "./config";

const prisma = new PrismaClient();

export async function cleanupDatabase() {
  // 通知を削除
  await prisma.notification.deleteMany();

  // 分析データを削除
  await prisma.analytics.deleteMany();

  // タスクを削除
  await prisma.task.deleteMany();

  // グループメンバーシップを削除（保持するユーザーのメンバーシップも削除）
  await prisma.groupMembership.deleteMany();

  // グループを削除
  await prisma.group.deleteMany();

  // ユーザー設定を削除（保持するユーザー以外）
  await prisma.userSettings.deleteMany({
    where: {
      userId: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  // セッションを削除（保持するユーザー以外）
  await prisma.session.deleteMany({
    where: {
      userId: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  // 認証トークンを削除
  await prisma.verificationToken.deleteMany();

  // アカウントを削除（保持するユーザー以外）
  await prisma.account.deleteMany({
    where: {
      userId: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  // ユーザーを削除（保持するユーザー以外）
  await prisma.user.deleteMany({
    where: {
      id: {
        notIn: PRESERVED_USER_IDS,
      },
    },
  });

  console.log("データベースをクリーンアップしました（特定のユーザーは保持しました）");
}
