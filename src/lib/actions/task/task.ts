"use server";

import { revalidatePath } from "next/cache";
import { checkIsPermission } from "@/lib/actions/permission";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { contributionType, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを削除するサーバーアクション
 * @param taskId 削除するタスクのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteTask(taskId: string) {
  try {
    // 現在のユーザーを取得
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 権限チェック
     */
    const isOwner = await checkIsPermission(userId, undefined, taskId, true);

    if (!isOwner.success) {
      return { success: false, error: "このタスクを削除する権限がありません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを取得
     */
    // タスクを取得（関連エンティティも含む）
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        contributionType: true,
        status: true,
        groupId: true,
        creator: {
          select: {
            id: true,
          },
        },
        reporters: {
          select: {
            userId: true,
          },
        },
        executors: {
          select: {
            userId: true,
          },
        },
        group: {
          select: {
            members: {
              where: {
                userId: userId,
                isGroupOwner: true,
              },
            },
          },
        },
        auction: true,
      },
    });

    if (!task) {
      return { success: false, error: "タスクが見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスク状態のチェック
     */
    // タスク状態のチェック
    if (task.contributionType === contributionType.REWARD) {
      // 報酬タスクの場合、オークションがPENDINGの場合のみ削除可能
      if (!task.auction || task.status !== "PENDING") {
        return { success: false, error: "オークションが開始されているタスクは削除できません" };
      }
    } else {
      // 非報酬タスクの場合、ステータスがPENDINGの場合のみ削除可能
      if (task.status !== "PENDING") {
        return { success: false, error: "進行中または完了したタスクは削除できません" };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを削除
     */
    // タスクを削除（カスケード削除により関連エンティティも削除される）
    await prisma.task.delete({
      where: { id: taskId },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュを再検証
     */
    revalidatePath(`/groups/${task.groupId}`);
    revalidatePath(`/dashboard/group/${task.groupId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返却
     */
    return { success: true };
  } catch (error) {
    console.error("タスク削除エラー:", error);
    return { success: false, error: "タスクの削除中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクのステータスを更新する関数
 * @param taskId - 更新するタスクのID
 * @param newStatus - 新しいステータス
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDを取得
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの詳細情報を取得
     */
    // タスクの詳細情報を取得
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        group: true,
        fixedContributionPoint: true,
        groupId: true,
        creator: {
          select: {
            id: true,
          },
        },
        reporters: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
        executors: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクが見つからない場合はエラーを返す
     */
    if (!task) {
      throw new Error("Task not found");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 変更不可のステータスチェック
     */
    const immutableStatuses: TaskStatus[] = [
      TaskStatus.FIXED_EVALUATED,
      TaskStatus.POINTS_AWARDED,
      TaskStatus.ARCHIVED,
    ];
    if (immutableStatuses.includes(newStatus)) {
      return { error: "このステータスのタスクは変更できません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 権限チェック
     */
    const isOwner = await checkIsPermission(userId, task.groupId, taskId, true);

    if (!isOwner.success) {
      return { error: "このタスクのステータスを変更する権限がありません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを更新
     */
    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ステータスがPOINTS_AWARDEDに変更されたかつfixedContributionPointが設定されている場合
     * ポイント付与処理
     */
    if (newStatus === TaskStatus.POINTS_AWARDED && task.fixedContributionPoint) {
      // GroupPointテーブルの残高を更新
      const contributionPoint = task.fixedContributionPoint;

      // 報告者と実行者のユーザーIDを取得（重複排除）
      const reporterUserIds = task.reporters.filter((r) => r.user?.id).map((r) => r.user!.id);

      const executorUserIds = task.executors.filter((e) => e.user?.id).map((e) => e.user!.id);

      const userIds = [...new Set([...reporterUserIds, ...executorUserIds])];

      // 各ユーザーのGroupPointを更新
      for (const userId of userIds) {
        // 既存のGroupPointを検索
        const groupPoint = await prisma.groupPoint.findUnique({
          where: {
            userId_groupId: {
              userId: userId,
              groupId: task.groupId,
            },
          },
        });

        // GroupPointが存在しなければ作成、存在すれば更新
        if (groupPoint) {
          await prisma.groupPoint.update({
            where: {
              userId_groupId: {
                userId: userId,
                groupId: task.groupId,
              },
            },
            data: {
              balance: { increment: contributionPoint },
              fixedTotalPoints: { increment: contributionPoint },
            },
          });
        } else {
          await prisma.groupPoint.create({
            data: {
              userId: userId,
              groupId: task.groupId,
              balance: contributionPoint,
              fixedTotalPoints: contributionPoint,
            },
          });
        }
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返却
     */
    return { success: true };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return { error: "タスクのステータスの更新中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
