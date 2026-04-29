"use server";

import type { TaskFormValuesAndGroupId, TaskParticipant } from "@/hooks/form/use-create-task-form";
import { revalidatePath } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";
import { ContributionType } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成パラメータの型定義（サーバーアクション用）
 */
export type CreateTaskParams = TaskFormValuesAndGroupId & {
  isExtension?: boolean | string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成フォームのデータを返却
 */
export type PrepareCreateTaskFormReturn = {
  groups: { id: string; name: string }[];
  users: { id: string; name: string }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成フォームのデータを取得
 * @returns タスク作成フォームのデータ
 */
export async function prepareCreateTaskForm(): PromiseResult<PrepareCreateTaskFormReturn> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーID
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループを取得
   */
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: userId,
    },
    select: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが所属するグループがない場合は空の配列を返却
   */
  if (memberships.length === 0) {
    return {
      success: false,
      message: "ユーザーが所属するグループがないため、タスク作成フォームのデータを返却できません",
      data: { groups: [], users: [] },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを整形
   */
  const groups: PrepareCreateTaskFormReturn["groups"] = memberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループに所属するユーザー一覧を取得
   */
  let users: PrepareCreateTaskFormReturn["users"] = [];
  // ユーザーが所属するすべてのグループのメンバーを取得
  const allGroupIds = groups.map((group) => group.id);
  // グループが存在する場合のみユーザーを取得
  if (allGroupIds.length > 0) {
    const groupMembers = await prisma.groupMembership.findMany({
      where: {
        groupId: {
          in: allGroupIds,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            settings: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    // 重複ユーザーを削除
    const uniqueUsers = new Map<string, { id: string; name: string }>();
    groupMembers.forEach((member) => {
      uniqueUsers.set(member.user.id, {
        id: member.user.id,
        name: member.user.settings?.username ?? `未設定_${member.user.id}`,
      });
    });

    users = Array.from(uniqueUsers.values());
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク作成フォームのデータを返却
   */
  return {
    success: true,
    message: "タスク作成フォームのデータを返却しました",
    data: { groups: groups, users: users },
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクを作成する関数
 * @param data - タスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createTask(data: CreateTaskParams): PromiseResult<null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループの存在確認
   */
  const group = await prisma.group.findUnique({
    where: { id: data.groupId },
    select: {
      id: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループが見つからない場合はエラーを返す
   */
  if (!group) {
    throw new Error("指定されたグループが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 認証セッションを取得
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクを作成
   */
  const newTask = await prisma.task.create({
    data: {
      task: data.task,
      detail: data.detail,
      reference: data.reference,
      info: data.info,
      imageUrl: data.imageUrl,
      contributionType: data.contributionType,
      category: data.category,
      creatorId: userId,
      groupId: data.groupId,
      deliveryMethod: data.deliveryMethod,
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 報酬タイプがREWARDの場合はオークションを作成
   */
  if (data.contributionType === ContributionType.REWARD) {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * デフォルトの日時を設定
     */
    const startTime = data.auctionStartTime ?? new Date();
    const endTime = data.auctionEndTime ?? new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * isExtensionの値を適切に変換
     */
    const isExtension = typeof data.isExtension === "string" ? data.isExtension === "true" : Boolean(data.isExtension);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オークションを作成
     */
    await prisma.auction.create({
      data: {
        taskId: newTask.id,
        startTime,
        endTime,
        groupId: data.groupId,
        isExtension,
      },
    });
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パスを再検証
   */
  revalidatePath(`/dashboard/group/${data.groupId}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 成功を返却
   */
  return { success: true, message: "タスクを作成しました", data: null };
}
