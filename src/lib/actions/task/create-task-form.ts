"use server";

import type { TaskFormValuesAndGroupId, TaskParticipant } from "@/hooks/form/use-create-task-form";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { contributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成パラメータの型定義（サーバーアクション用）
 */
type CreateTaskParams = TaskFormValuesAndGroupId & {
  isExtension?: boolean | string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成フォームのデータを取得
 * @returns タスク作成フォームのデータ
 */
export async function prepareCreateTaskForm() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧
   */
  let groups: { id: string; name: string }[] = [];

  // ユーザーが参加しているグループを取得
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: userId,
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  groups = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループに所属するユーザー一覧を取得
   */
  let users: { id: string; name: string }[] = [];
  // ユーザーが所属するすべてのグループのメンバーを取得
  const allGroupIds = groups.map((group) => group.id);

  if (allGroupIds.length > 0) {
    const groupMembers = await prisma.groupMembership.findMany({
      where: {
        groupId: {
          in: allGroupIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 重複ユーザーを削除
    const uniqueUsers = new Map<string, { id: string; name: string }>();
    groupMembers.forEach((member) => {
      uniqueUsers.set(member.user.id, {
        id: member.user.id,
        name: member.user.name ?? "不明なユーザー",
      });
    });

    users = Array.from(uniqueUsers.values());
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク作成フォームのデータを返却
   */
  return { groups, users };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを作成する関数
 * @param data - タスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createTask(data: CreateTaskParams) {
  try {
    // groupIdの存在確認
    if (!data.groupId) {
      return { error: "グループIDが指定されていません" };
    }

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
    });

    if (!group) {
      return { error: "指定されたグループが見つかりません" };
    }

    // 認証セッションを取得
    const userId = await getAuthenticatedSessionUserId();

    // バリデーション
    if (!data || !data.groupId) {
      return { error: "必須項目が入力されていません" };
    }

    // タスクを作成
    const newTask = await prisma.task.create({
      data: {
        task: data.task,
        detail: data.detail,
        reference: data.reference,
        info: data.info,
        imageUrl: data.imageUrl,
        contributionType: data.contributionType,
        category: data.category, // カテゴリを追加
        creatorId: userId,
        groupId: data.groupId,
        // 提供方法を追加
        deliveryMethod: data.deliveryMethod,
        // 報告者の設定
        reporters: {
          create:
            data.reporters && data.reporters.length > 0
              ? // 報告者が指定されている場合
                data.reporters.map((reporter: TaskParticipant) => ({
                  name: reporter.name,
                  userId: reporter.userId,
                }))
              : // 報告者が指定されていない場合、作成者を報告者として追加
                [{ userId: userId }],
        },
        // 実行者の設定
        executors: {
          create:
            data.executors && data.executors.length > 0
              ? // 実行者が指定されている場合
                data.executors.map((executor: TaskParticipant) => ({
                  name: executor.name,
                  userId: executor.userId,
                }))
              : // 実行者が指定されていない場合、作成者を実行者として追加
                [{ userId: userId }],
        },
      },
    });

    // 作成したタスクを関連データを含めて再取得
    const taskWithRelations = await prisma.task.findUnique({
      where: { id: newTask.id },
      include: {
        creator: {
          select: {
            name: true,
          },
        },
        reporters: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        executors: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // 報酬タイプがREWARDの場合はオークションを作成
    if (data.contributionType === contributionType.REWARD) {
      // デフォルトの日時を設定
      const startTime = data.auctionStartTime ?? new Date();
      const endTime = data.auctionEndTime ?? new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // デフォルトは1週間後

      // isExtensionの値を適切に変換
      const isExtension = typeof data.isExtension === "string" ? data.isExtension === "true" : Boolean(data.isExtension);

      await prisma.auction.create({
        data: {
          taskId: newTask.id,
          startTime,
          endTime,
          currentHighestBid: 0,
          extensionTotalCount: 0,
          extensionLimitCount: 3,
          extensionTotalTime: 0,
          extensionLimitTime: 10,
          groupId: data.groupId,
          // isExtensionフィールドを追加
          isExtension,
        },
      });
    }

    revalidatePath(`/dashboard/group/${data.groupId}`);
    return { success: true, task: taskWithRelations ?? newTask };
  } catch (error) {
    console.error("[CREATE_TASK]", error);
    return { error: "タスクの作成中にエラーが発生しました" };
  }
}
