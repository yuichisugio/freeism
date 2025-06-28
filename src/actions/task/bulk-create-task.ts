"use server";

import type { Task } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/library-setting/prisma";
import { ContributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVからタスクを一括登録する関数
 * @param data - CSVから読み込んだタスクデータ
 * @param groupId - グループID
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkCreateTask(
  data: Array<{
    task: string;
    detail?: string | null;
    reference?: string | null;
    info?: string | null;
    contributionType?: string | null;
    deliveryMethod?: string | null;
    auctionStartTime?: string | Date;
    auctionEndTime?: string | Date;
  }>,
  groupId: string,
  userId: string,
): Promise<{
  success: boolean;
  tasks?: Task[];
  error?: string;
}> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータチェック
     */
    if (!groupId || !userId || !data || data.length === 0) {
      throw new Error("パラメータが不正です");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループの存在確認
     */
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      throw new Error("指定されたグループが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * トランザクションを使用してデータを一括登録
     */
    const result = await prisma.$transaction(async (tx) => {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * タスクを作成
       */
      const tasks = await Promise.all(
        data.map(async (row) => {
          const task = await tx.task.create({
            data: {
              task: row.task,
              detail: row.detail ?? null,
              reference: row.reference ?? null,
              info: row.info ?? null,
              contributionType: (row.contributionType as ContributionType) ?? ContributionType.NON_REWARD,
              creatorId: userId,
              groupId: groupId,
              // 提供方法を追加
              deliveryMethod: row.deliveryMethod ?? null,
              // 作成者を報告者としても登録
              reporters: {
                create: [
                  {
                    userId: userId,
                  },
                ],
              },
              // 作成者を実行者としても登録
              executors: {
                create: [
                  {
                    userId: userId,
                  },
                ],
              },
            },
            select: { id: true },
          });

          // 報酬タイプがREWARDの場合はオークションを作成
          if (row.contributionType === ContributionType.REWARD) {
            // 日時文字列をDate型に変換
            let startTime = new Date();
            let endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // デフォルトは1週間後

            if (row.auctionStartTime) {
              try {
                startTime = new Date(row.auctionStartTime);
              } catch (e) {
                console.error("開始日時の解析エラー:", e);
              }
            }

            if (row.auctionEndTime) {
              try {
                endTime = new Date(row.auctionEndTime);
              } catch (e) {
                console.error("終了日時の解析エラー:", e);
              }
            }

            await tx.auction.create({
              data: {
                taskId: task.id,
                startTime,
                endTime,
                currentHighestBid: 0,
                extensionTotalCount: 0,
                extensionLimitCount: 3,
                extensionTime: 10,
                remainingTimeForExtension: 10,
                groupId: groupId,
              },
            });
          }

          return task;
        }),
      );

      return tasks;
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 再検証
     */
    revalidatePath(`/dashboard/group/${groupId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 結果を返却
     */
    return { success: true, tasks: result as Task[] };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返却
     */
  } catch (error) {
    console.error("[BULK_CREATE_TASKS]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "タスクの一括登録中にエラーが発生しました",
    };
  }
}
