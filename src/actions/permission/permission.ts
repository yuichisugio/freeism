"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 権限があるかどうかをチェックする関数
 * @param userId - チェックするユーザーのID
 * @param groupId - チェックするグループのID
 * @param taskId - チェックするタスクのID
 * @param isRoleCheck - 出品者、報告者、実行者の場合も権限があるとみなしてOKか
 * @returns グループオーナーの場合はtrue、それ以外はfalse
 */
export async function checkIsPermission(
  propsUserId?: string,
  propsGroupId?: string,
  propsTaskId?: string,
  isRoleCheck?: boolean,
): PromiseResult<boolean> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDを取得
   */
  let userId = propsUserId;
  if (!propsUserId) {
    userId = await getAuthenticatedSessionUserId();
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * isRoleCheckがtrueの場合は、creater,reporter,executorでも権限ありとする
   */
  if (isRoleCheck) {
    // タスクIDが指定されていない場合はエラーを返す
    if (!propsTaskId) {
      return { success: false, data: false, message: "タスクIDが指定されていません" };
    }

    // タスクの詳細情報を取得
    const task = await prisma.task.findUnique({
      where: { id: propsTaskId },
      select: {
        creator: {
          select: {
            id: true,
          },
        },
        reporters: {
          where: {
            userId: userId,
            taskId: propsTaskId,
          },
          select: {
            id: true,
          },
        },
        executors: {
          where: {
            userId: userId,
            taskId: propsTaskId,
          },
          select: {
            id: true,
          },
        },
      },
    });

    // タスクが見つからない場合はエラーを返す
    if (!task) {
      return { success: false, data: false, message: "タスクが見つかりません" };
    }

    // タスクの作成者、タスクの報告者、タスクの実行者のいずれかがユーザーIDと一致する場合はtrueを返す
    const isCreator = task.creator.id === userId;
    const isReporter = task.reporters.find((reporter) => reporter.id === userId);
    const isExecutor = task.executors.find((executor) => executor.id === userId);
    if (isCreator || isReporter || isExecutor) {
      return { success: true, data: true, message: "タスクの作成者or報告者or実行者の権限があります" };
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Appオーナー権限があるかチェック
   */
  const appOwner = await prisma.user.findUnique({
    where: {
      id: userId,
      isAppOwner: true,
    },
    select: {
      id: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Appオーナー権限がある場合はtrueを返す
   */
  if (appOwner) {
    return { success: true, data: true, message: "Appオーナー権限があります" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループIDとタスクIDが指定されていない場合はエラーを返す
   */
  if (!propsGroupId && !propsTaskId) {
    return { success: false, data: false, message: "グループIDとタスクIDが指定されていません" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループIDが指定されていない && タスクIDが指定されている場合は、タスクIDからグループIDを取得
   */

  if (!propsGroupId && propsTaskId) {
    // タスクIDからグループIDを取得
    const task = await prisma.task.findUnique({
      where: { id: propsTaskId },
      select: {
        groupId: true,
      },
    });

    // タスクが見つからない場合はエラーを返す
    if (!task) {
      return { success: false, data: false, message: "タスクが見つかりません" };
    }

    // タスクのグループIDを取得
    propsGroupId = task.groupId;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Groupオーナー権限があるかチェック
   */
  const membership = await prisma.groupMembership.findFirst({
    where: {
      userId,
      groupId: propsGroupId,
      isGroupOwner: true,
    },
    select: {
      id: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Groupオーナー権限がない場合はfalseを返す
   */
  if (!membership) {
    return { success: false, data: false, message: "グループオーナー権限がありません" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * Groupオーナー権限がある場合はtrueを返す
   */
  return { success: !!membership, data: true, message: "Groupオーナー権限があります" };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループオーナー権限を付与する関数
 * @param groupId - 権限を付与するグループのID
 * @param userId - 権限を付与するユーザーのID
 * @returns 処理結果を含むオブジェクト
 */
export async function grantOwnerPermission(groupId: string, userId: string): PromiseResult<boolean> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (!groupId || !userId) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 操作者（認証されているユーザー）がグループオーナーかチェック
   */
  const isOwner = await checkIsPermission(userId, groupId, undefined, false);
  if (!isOwner.success) {
    return { success: false, data: false, message: "アプリオーナー or グループオーナー権限がありません" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 対象ユーザーのグループメンバーシップを取得
   */
  const targetMembership = await checkGroupMembership(userId, groupId);
  if (!targetMembership.success) {
    return { success: false, data: false, message: "指定されたユーザーはグループに参加していません" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 既にオーナー権限を持っている場合
   */
  if (targetMembership.data?.isGroupOwner) {
    return { success: false, data: false, message: "指定されたユーザーは既にグループオーナーです" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループオーナー権限を付与
   */
  await prisma.groupMembership.update({
    where: {
      id: targetMembership.data?.id,
    },
    data: {
      isGroupOwner: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パスを再検証
   */
  revalidatePath(`/dashboard/group/${groupId}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 結果を返却
   */
  return { success: true, data: true, message: "グループオーナー権限を付与しました" };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加チェックを行う関数
 * @param userId - チェックするユーザーのID
 * @param groupId - チェックするグループのID
 * @returns グループメンバーシップ、存在しない場合はnull
 */
export async function checkGroupMembership(
  userId: string,
  groupId: string,
): PromiseResult<{
  id: string;
  isGroupOwner: boolean;
} | null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (!userId || !groupId) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーシップを取得
   */
  const membership = await prisma.groupMembership.findFirst({
    where: {
      userId,
      groupId,
    },
    select: {
      id: true,
      isGroupOwner: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーシップが存在しない場合はnullを返す
   */
  if (!membership) {
    return { success: false, data: null, message: "グループメンバーシップが存在しません" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーシップを返す
   */
  return {
    success: true,
    data: {
      id: membership.id,
      isGroupOwner: membership.isGroupOwner,
    },
    message: "グループメンバーシップを取得しました",
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 一つでもグループオーナー権限があればtrueを返す
 * 通知のUIを決めるために必要
 * @param userId - チェックするユーザーのID
 * @returns グループオーナー権限があればtrue、なければfalse
 */
export async function checkOneGroupOwner(userId: string): PromiseResult<boolean> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (!userId) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループオーナー情報を取得
   */
  const userGroupMemberships = await prisma.groupMembership.findFirst({
    where: {
      userId: userId,
      isGroupOwner: true,
    },
    select: {
      groupId: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループオーナー権限があるかどうかを返す
   */
  if (userGroupMemberships) {
    return { success: true, data: true, message: "グループオーナー権限があります" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループオーナー権限がない場合はfalseを返す
   */
  return { success: false, data: false, message: "グループオーナー権限がありません" };
}
