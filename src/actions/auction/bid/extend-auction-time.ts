import { type prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション延長処理のパラメータ型
 */
export type ProcessAuctionExtensionParams = {
  auctionId: string;
  auction: {
    isExtension: boolean;
    extensionTotalCount: number;
    extensionLimitCount: number;
    extensionTime: number;
    endTime: Date;
    startTime: Date;
  };
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]; // Prismaトランザクション型
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オークション延長処理を行う関数
 * @param params 延長処理のパラメータ
 * @returns 延長処理の結果
 */
export async function processAuctionExtension(params: ProcessAuctionExtensionParams): PromiseResult<Date | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの分割
   */
  const { auctionId, auction, tx } = params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 延長条件チェック：isExtensionがtrueのオークションのみ延長
   */
  if (!auction.isExtension) {
    return {
      success: false,
      message: "延長不可のオークションです",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 延長回数の制限チェック
   */
  if (auction.extensionTotalCount >= auction.extensionLimitCount) {
    return {
      success: false,
      message: "延長回数の上限に達しています",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 延長トリガーの条件チェック
   */
  // 現在時刻を取得
  const now = new Date();
  const endTime = auction.endTime;
  const startTime = auction.startTime;

  // 残り時間を計算（ミリ秒）
  const remainingTime = endTime.getTime() - now.getTime();

  // オークション期間全体の時間を計算（ミリ秒）
  const totalAuctionTime = endTime.getTime() - startTime.getTime();

  // 延長トリガーの時間を計算
  // 「endTimeとstartTimeの差分の5%の時間」or「extensionTime分」のどちらか長い時間
  const fivePercentTime = totalAuctionTime * 0.05;
  const extensionTimeMs = auction.extensionTime * 60 * 1000; // 分をミリ秒に変換
  const triggerTime = Math.max(fivePercentTime, extensionTimeMs);

  // 延長トリガーの条件チェック：残り時間が指定の条件以下の場合
  if (remainingTime > triggerTime) {
    return {
      success: false,
      message: "延長トリガーの条件を満たしていません",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 延長時間を計算
   */
  // 「endTimeとstartTimeの差分の5%」or「extensionTime分」のどちらか長い時間
  const extensionDuration = Math.max(fivePercentTime, extensionTimeMs);

  // 新しい終了時間を計算
  const newEndTime = new Date(endTime.getTime() + extensionDuration);

  // オークション情報を更新（endTimeを延長し、extensionTotalCountを1増加）
  await tx.auction.update({
    where: { id: auctionId },
    data: {
      endTime: newEndTime,
      extensionTotalCount: { increment: 1 },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    success: true,
    data: newEndTime,
    message: `オークションが${Math.round(extensionDuration / (60 * 1000))}分延長されました`,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
