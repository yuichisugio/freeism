"use server";

import type { TaskFormValuesAndGroupId, TaskParticipant } from "@/hooks/form/use-create-task-form";
import { revalidatePath } from "next/cache";
import { checkIsOwner } from "@/lib/actions/permission";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを更新する関数
 * @param taskId - 更新するタスクのID
 * @param data - 更新するタスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskAction(taskId: string, data: Omit<TaskFormValuesAndGroupId, "groupId">) {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証セッションを取得
     */
    const userId = await getAuthenticatedSessionUserId();

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
      return { error: "更新対象のタスクが見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループ所有者またはアプリ所有者か確認
     */
    const isOwnerOrRoleCheck = await checkIsOwner(userId, existingTask.groupId, undefined, true);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 権限チェック（タスク作成者、グループ所有者、またはアプリ所有者のみ更新可能）
     */
    if (!isOwnerOrRoleCheck.success) {
      return { error: "このタスクを更新する権限がありません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクと関連データの更新をトランザクションで行う
     */
    const updatedTask = await prisma.$transaction(async (prismaClient) => {
      // 1. 既存の報告者と実行者を削除
      if (data.reporters || data.executors) {
        if (data.reporters) {
          await prismaClient.taskReporter.deleteMany({
            where: { taskId: taskId },
          });
        }

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
        },
      });

      // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

      /**
       * 貢献タイプがREWARDに変更され、オークションが存在しない場合は新規作成
       */
      if (data.contributionType === contributionType.REWARD && !existingAuction) {
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
       * 貢献タイプがNON_REWARDに変更され、オークションが存在する場合は削除
       */
      else if (data.contributionType === contributionType.NON_REWARD && existingAuction) {
        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * オークションに入札がある場合は削除しない
         */
        // オークションに入札がある場合は削除しない
        const hasBids = await prismaClient.bidHistory.findFirst({
          where: { auctionId: existingAuction.id },
        });

        // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

        /**
         * 入札がある場合は警告を追加（タスクの更新自体は行う）
         */
        if (!hasBids) {
          await prismaClient.auction.delete({
            where: { id: existingAuction.id },
          });
        } else {
          // 入札がある場合は警告を追加（タスクの更新自体は行う）
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
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("[UPDATE_TASK_ACTION]", error);
    return { error: "タスクの更新中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクIDに基づいてタスク詳細を取得する関数
 * @param taskId - タスクのID
 * @returns タスク詳細データ、またはエラー
 */
export async function getTaskById(taskId: string) {
  try {
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

    if (!task) {
      return { error: "タスクが見つかりません" };
    }

    return { success: true, task };
  } catch (error) {
    console.error("[GET_TASK_BY_ID]", error);
    return { error: "タスクの取得中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
