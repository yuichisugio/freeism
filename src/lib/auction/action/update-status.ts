"use server";

import { prisma } from "@/lib/prisma";
import { AuctionStatus } from "@prisma/client";

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
  }
}
