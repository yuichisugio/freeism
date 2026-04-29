"use server";

import type { TaskFormValuesAndGroupId, TaskParticipant } from "@/hooks/form/use-create-task-form";
import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/actions/permission/permission";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { ContributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを更新する関数
 * @param taskId - 更新するタスクのID
 * @param data - 更新するタスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskAction(
  taskId: string,
  data: Omit<TaskFormValuesAndGroupId, "groupId">,
): PromiseResult<null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクIDが指定されていない場合はエラーを返す
   */
  if (!taskId) {
    throw new Error("タスクIDが指定されていません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 既存のタスクを取得
   */
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      groupId: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクが見つからない場合はエラーを返す
   */
  if (!existingTask) {
    throw new Error("更新対象のタスクが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ所有者またはアプリ所有者か確認
   */
  const isOwnerOrRoleCheck = await checkIsPermission(undefined, existingTask.groupId, taskId, true);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限チェック（タスク作成者、グループ所有者、またはアプリ所有者のみ更新可能）
   */
  if (!isOwnerOrRoleCheck.success) {
    return {
      success: false,
      message: isOwnerOrRoleCheck.message,
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクと関連データの更新をトランザクションで行う
   */
  await prisma.$transaction(async (prismaClient) => {
    // 1. 既存の報告者と実行者を削除
    if (data.reporters || data.executors) {
      // 報告者を削除
      if (data.reporters) {
        await prismaClient.taskReporter.deleteMany({
          where: { taskId: taskId },
        });
      }

      // 実行者を削除
      if (data.executors) {
        await prismaClient.taskExecutor.deleteMany({
          where: { taskId: taskId },
        });
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 2. タスクの基本情報を更新
     */
    const result = await prismaClient.task.update({
      where: { id: taskId },
      data: {
        task: data.task,
        detail: data.detail,
        reference: data.reference,
        info: data.info,
        imageUrl: data.imageUrl,
        contributionType: data.contributionType,
        category: data.category,

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * 3. 新しい報告者を登録
         */
        reporters: data.reporters
          ? {
              create: data.reporters.map((reporter: TaskParticipant) => ({
                name: reporter.name,
                userId: reporter.userId,
              })),
            }
          : undefined,

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * 4. 新しい実行者を登録
         */
        executors: data.executors
          ? {
              create: data.executors.map((executor: TaskParticipant) => ({
                name: executor.name,
                userId: executor.userId,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        task: true,
        detail: true,
        reference: true,
        info: true,
        imageUrl: true,
        contributionType: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        reporters: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        executors: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションの情報更新またはオークション作成
     */
    const existingAuction = await prismaClient.auction.findUnique({
      where: { taskId: taskId },
      select: {
        id: true,
        task: {
          select: {
            contributionType: true,
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 貢献タイプがREWARDに変更され、オークションが存在しない場合は新規作成
     */
    if (data.contributionType === ContributionType.REWARD && !existingAuction) {
      // タスクのgroupIdを使用してオークションを作成
      await prismaClient.auction.create({
        data: {
          taskId: taskId,
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // デフォルト1週間後
          currentHighestBid: 0,
          extensionTotalCount: 0,
          extensionLimitCount: 3,
          extensionTime: 10,
          remainingTimeForExtension: 10,
          groupId: existingTask.groupId, // タスクに関連付けられたグループIDを使用
        },
      });
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 貢献タイプがREWARDからNON_REWARDに変更され、オークションが存在する場合は削除
     */
    else if (
      data.contributionType === ContributionType.NON_REWARD &&
      existingAuction &&
      existingAuction.task.contributionType === ContributionType.REWARD
    ) {
      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * オークションに入札がある場合は削除しない
       */
      const hasBids = await prismaClient.bidHistory.findFirst({
        where: { auctionId: existingAuction.id },
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 入札がある場合は警告を追加（タスクの更新自体は行うが、オークションは削除しない）
       */
      if (!hasBids) {
        await prismaClient.auction.delete({
          where: { id: existingAuction.id },
        });
      } else {
        console.warn(`タスク ${taskId} は入札があるため、オークションは削除されませんでした`);
      }
    }

    return result;
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パスを再検証
   */
  revalidatePath(`/dashboard/group/${existingTask.groupId}`);
  revalidatePath("/dashboard/my-tasks");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 成功を返す
   */
  return { success: true, message: "タスクが更新されました", data: null };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクIDに基づいてタスク詳細を取得する関数の戻り値の型
 */
export type TaskDetailWithRelations = {
  id: string;
  task: string;
  detail: string | null;
  reference: string | null;
  info: string | null;
  imageUrl: string | null;
  contributionType: ContributionType;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    id: string;
    name: string | null;
  };
  reporters: Array<{
    id: string;
    name: string | null;
    userId: string | null;
    user: {
      id: string;
      name: string | null;
    } | null;
  }>;
  executors: Array<{
    id: string;
    name: string | null;
    userId: string | null;
    user: {
      id: string;
      name: string | null;
    } | null;
  }>;
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string | null;
    evaluationMethod: string | null;
    depositPeriod: number;
    members: Array<{
      userId: string;
    }>;
  };
  auction: {
    id: string;
    startTime: Date;
    endTime: Date;
    currentHighestBid: number;
    currentHighestBidderId: string | null;
    winnerId: string | null;
    extensionLimitCount: number;
    extensionTotalCount: number;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクIDに基づいてタスク詳細を取得する関数
 * @param taskId - タスクのID
 * @returns タスク詳細データ、またはエラー
 */
export async function getTaskById(taskId: string): PromiseResult<TaskDetailWithRelations> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクIDが指定されていない場合はエラーを返す
   */
  if (!taskId) {
    throw new Error("タスクIDが指定されていません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクを取得
   */
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      task: true,
      detail: true,
      reference: true,
      info: true,
      imageUrl: true,
      contributionType: true,
      category: true,
      createdAt: true,
      updatedAt: true,
      creator: {
        select: {
          id: true,
          name: true,
        },
      },
      reporters: {
        select: {
          id: true,
          name: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      executors: {
        select: {
          id: true,
          name: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          maxParticipants: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          members: {
            select: {
              userId: true,
            },
          },
        },
      },
      auction: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          currentHighestBid: true,
          currentHighestBidderId: true,
          winnerId: true,
          extensionLimitCount: true,
          extensionTotalCount: true,
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクが見つからない場合はエラーを返す
   */
  if (!task) {
    throw new Error("タスクが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 成功を返す
   */
  return { success: true, message: "タスクが取得されました", data: task };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
