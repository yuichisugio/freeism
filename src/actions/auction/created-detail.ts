"use server";

import type { AuctionHistoryCreatedDetail } from "@/types/auction-types";
import { revalidateTag } from "next/cache";
import { checkIsPermission } from "@/actions/permission/permission";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { TaskStatus } from "@prisma/client";

import { getCachedAuctionHistoryCreatedDetail } from "./cache/cache-auction-history";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品商品詳細を取得
 * @param auctionId 出品商品のID
 * @returns 出品商品の詳細
 */
export async function getAuctionHistoryCreatedDetail(auctionId: string): PromiseResult<AuctionHistoryCreatedDetail> {
  return await getCachedAuctionHistoryCreatedDetail(auctionId);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 出品者が提供方法を更新するアクション
 * @param taskId タスクID
 * @param deliveryMethod 提供方法
 */
export async function updateDeliveryMethod(
  taskId: string,
  deliveryMethod: string,
  userId: string,
): PromiseResult<null> {
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
    return {
      success: false,
      message: "タスクの提供方法を入力してください",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が作成したタスクかチェック
   */
  const { success, message: error } = await checkIsPermission(userId, undefined, taskId, true);

  if (!success) {
    return {
      success: false,
      message: error ?? "このタスクを編集する権限がありません",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新
   */
  await prisma.task.update({
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
  revalidateTag(useCacheKeys.auctionCreatedDetail.auctionByAuctionId(taskId).join(":"));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 提供方法を更新
   */
  return {
    success: true,
    message: "提供方法を更新しました",
    data: null,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理アクション
 * @param taskId タスクID
 */
export async function completeTaskDelivery(taskId: string, userId: string): PromiseResult<null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクID、ユーザーIDがない場合
   */
  if (!taskId || !userId) {
    throw new Error("タスク完了処理: タスクID、ユーザーIDが必要です");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分が出品者のタスクかチェック
   */
  const { success, message: error } = await checkIsPermission(userId, undefined, taskId, true);
  if (!success) {
    return {
      success: false,
      message: error ?? "タスク完了処理: このタスクを編集する権限がありません",
      data: null,
    };
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
  revalidateTag(useCacheKeys.auctionCreatedDetail.auctionByAuctionId(taskId).join(":"));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク完了処理に成功しました
   */
  return {
    success: true,
    message: "タスク完了処理に成功しました",
    data: null,
  };
}
