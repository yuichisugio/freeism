"use server";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { revalidateTag } from "next/cache";
import { checkIsPermission } from "@/lib/actions/permission";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";

import { getCachedAuctionHistoryCreatedDetail } from "./cache/cache-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getAuctionHistoryCreatedDetail(auctionId: string): Promise<AuctionHistoryCreatedDetail> {
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
export async function updateDeliveryMethod(taskId: string, deliveryMethod: string, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクID、提供方法、ユーザーIDがない場合
   */
  if (!taskId || !deliveryMethod || !userId) {
    throw new Error("タスクID、提供方法、ユーザーIDが必要です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法が入力されていない場合
   */
  if (!deliveryMethod.trim()) {
    throw new Error("提供方法を入力してください");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が作成したタスクかチェック
   */
  const { success, message: error } = await checkIsPermission(userId, undefined, taskId, true);

  if (!success) {
    throw new Error(error ?? "このタスクを編集する権限がありません");
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
      deliveryMethod: deliveryMethod.trim(),
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュを無効化
   */
  revalidateTag(`auction-history-created-detail:${taskId}`);

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
export async function completeTaskDelivery(
  taskId: string,
  userId: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクID、ユーザーIDがない場合
   */
  if (!taskId || !userId) {
    throw new Error("タスクID、ユーザーIDが必要です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品者のタスクかチェック
   */
  const { success, message: error } = await checkIsPermission(userId, undefined, taskId, true);
  if (!success) {
    throw new Error(error ?? "このタスクを編集する権限がありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク完了ステータスに更新
   */
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
