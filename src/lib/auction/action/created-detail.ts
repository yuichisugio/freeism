"use server";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { TaskStatus } from "@prisma/client";

import { getCachedAuctionHistoryCreatedDetail } from "./cache/cache-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getAuctionHistoryCreatedDetail(auctionId: string): Promise<AuctionHistoryCreatedDetail | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品の詳細を取得
   */
  const auction = await getCachedAuctionHistoryCreatedDetail(auctionId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 出品商品の詳細を返却
   */
  return auction;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者が提供方法を更新するアクション
 * @param taskId タスクID
 * @param deliveryMethod 提供方法
 */
export async function updateDeliveryMethod(taskId: string, deliveryMethod: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュを無効化
   */
  revalidateTag(`auction-history-created-detail:${taskId}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分のIDを取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法が入力されていない場合は、何もしない
   */
  if (!deliveryMethod.trim()) {
    return;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が作成したタスクかチェック
   */
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [{ creatorId: userId }, { executors: { some: { userId: userId } } }, { reporters: { some: { userId: userId } } }],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が作成したタスクかチェック
   */
  if (!task) {
    console.log("[updateDeliveryMethod] task", task);
    throw new Error("このタスクを編集する権限がありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新
   */
  const updatedTask = await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      deliveryMethod,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新
   */
  return updatedTask;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const userId = await getAuthenticatedSessionUserId();

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
    },
    select: {
      creatorId: true,
      executors: {
        select: {
          id: true,
        },
      },
      reporters: {
        select: {
          id: true,
        },
      },
      auction: {
        select: {
          winnerId: true,
        },
      },
    },
  });

  if (!task) {
    throw new Error("タスクが見つかりません");
  }

  // 自分が作成者か落札者か確認
  const isCreator = task.creatorId === userId;
  const isExecutor = task.executors.some((executor) => executor.id === userId);
  const isReporter = task.reporters.some((reporter) => reporter.id === userId);
  const isWinner = task.auction?.winnerId === userId;

  if (!isCreator && !isExecutor && !isReporter && !isWinner) {
    return {
      success: false,
      error: "このタスクを完了する権限がありません",
    };
  }

  // タスク完了ステータスに更新
  await prisma.task.update({
    where: {
      id: taskId,
    },
    data: {
      status: TaskStatus.SUPPLIER_DONE,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュを無効化
   */
  revalidateTag(`auction-history-created-detail:${taskId}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    success: true,
  };
}
