#!/usr/bin/env tsx
/**
 * オークションのステータスを更新するスクリプト
 * GitHub Actionsから実行するためのスクリプトです
 */
import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークションのステータスを更新する
 * startTimeカラムが今日以前かつstatusがPENDINGのオークションをACTIVEに更新する
 *
 * @returns 更新されたオークションの数
 */
async function updateAuctionStatusToActive(): Promise<number> {
  try {
    // 現在の日時を取得
    const now = new Date();

    // startTimeが現在時刻以前かつstatusがPENDINGのオークションを検索して更新
    const result = await prisma.auction.updateMany({
      where: {
        startTime: {
          lte: now, // less than or equal to now
        },
        status: AuctionStatus.PENDING,
      },
      data: {
        status: AuctionStatus.ACTIVE,
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
async function main() {
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

// スクリプト実行
main().catch((error) => {
  console.error("スクリプト実行中にエラーが発生しました:", error);
  process.exit(1);
});
