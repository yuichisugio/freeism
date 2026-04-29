#!/usr/bin/env tsx
/**
 * オークションのステータスを更新するスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 */
import { fileURLToPath } from "node:url";
import { prisma } from "@/library-setting/prisma";
import { TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションのステータスを更新する
 * startTimeカラムが今日以前かつstatusがPENDINGのオークションをACTIVEに更新する
 *
 * @returns 更新されたオークションの数
 */
export async function updateAuctionStatusToActive(): Promise<number> {
  try {
    // 現在の日時を取得
    const now = new Date();

    // startTimeが現在時刻以前かつstatusがPENDINGのオークションを検索して更新
    const result = await prisma.task.updateMany({
      where: {
        status: TaskStatus.PENDING,
        auction: {
          startTime: {
            lte: now, // less than or equal to now
          },
        },
      },
      data: {
        status: TaskStatus.AUCTION_ACTIVE,
      },
    });

    console.log(`${result.count}件のオークションを開始しました。`);

    return result.count;
  } catch (error) {
    console.error("オークション開始処理でエラーが発生しました:", error);
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
    console.log("オークションのステータスを更新します...");

    // オークション開始処理を実行
    const updatedCount = await updateAuctionStatusToActive();

    console.log(`処理が完了しました。${updatedCount}件のオークションのステータスを更新しました。`);
    process.exit(0);
  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// スクリプト実行（テスト時は実行しない）
// ES moduleでスクリプトが直接実行されているかを判定
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error("スクリプト実行中にエラーが発生しました:", error);
    process.exit(1);
  });
}
