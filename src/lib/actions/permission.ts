"use server";

import type { GroupMembership } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

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
): Promise<{ success: boolean; message: string }> {
  try {
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
        return { success: false, message: "タスクIDが指定されていません" };
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
        return { success: false, message: "タスクが見つかりません" };
      }

      // タスクの作成者、タスクの報告者、タスクの実行者のいずれかがユーザーIDと一致する場合はtrueを返す
      const isCreator = task.creator.id === userId;
      const isReporter = task.reporters.find((reporter) => reporter.id);
      const isExecutor = task.executors.find((executor) => executor.id);
      if (isCreator || isReporter || isExecutor) {
        return { success: true, message: "タスクの作成者or報告者or実行者の権限があります" };
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
      return { success: true, message: "Appオーナー権限があります" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループIDとタスクIDが指定されていない場合はエラーを返す
     */
    if (!propsGroupId && !propsTaskId) {
      return { success: false, message: "グループIDとタスクIDが指定されていません" };
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
        return { success: false, message: "タスクが見つかりません" };
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
      return { success: false, message: "グループオーナー権限がありません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * Groupオーナー権限がある場合はtrueを返す
     */
    return { success: !!membership, message: "Groupオーナー権限があります" };
  } catch (error) {
    console.error("[CHECK_GROUP_OWNER]", error);
    return { success: false, message: "権限のチェック中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループオーナー権限を付与する関数
 * @param groupId - 権限を付与するグループのID
 * @param userId - 権限を付与するユーザーのID
 * @returns 処理結果を含むオブジェクト
 */
export async function grantOwnerPermission(
  groupId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータの検証
     */
    if (!groupId || !userId) {
      throw new Error("無効なパラメータが指定されました");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 操作者がグループオーナーかチェック
     */
    const isOwner = await checkIsPermission(userId, groupId);
    if (!isOwner.success) {
      return { success: false, error: "グループオーナー権限がありません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 対象ユーザーのグループメンバーシップを取得
     */
    const targetMembership = await checkGroupMembership(userId, groupId);
    if (!targetMembership) {
      return { success: false, error: "指定されたユーザーはグループに参加していません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 既にオーナー権限を持っている場合
     */
    if (targetMembership.isGroupOwner) {
      return { success: false, error: "指定されたユーザーは既にグループオーナーです" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループオーナー権限を付与
     */
    await prisma.groupMembership.update({
      where: {
        id: targetMembership.id,
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
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("[GRANT_OWNER_PERMISSION]", error);
    return { success: false, error: "グループオーナー権限の付与中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アプリオーナー権限をチェックする関数
 * 通知作成で、アプリオーナー権限があるかどうかをチェックするために使用。Appオーナー権限は、ユーザー指定の通知を送れる
 * @param userId - チェックするユーザーのID
 * @returns アプリオーナー権限があればtrue、なければfalse
 */
export async function checkIsAppOwner(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータの検証
     */
    if (!userId) {
      throw new Error("無効なパラメータが指定されました");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーを取得
     */
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAppOwner: true },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーが見つからない場合はエラーを返す
     */
    if (!user) {
      return { success: false, error: "ユーザーが見つかりません" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * アプリオーナー権限があるかどうかを返す
     */
    return { success: !!user.isAppOwner };
  } catch (error) {
    console.error("[CHECK_APP_OWNER]", error);
    return { success: false, error: "アプリオーナー権限のチェック中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加チェックを行う関数
 * @param userId - チェックするユーザーのID
 * @param groupId - チェックするグループのID
 * @returns グループメンバーシップ、存在しない場合はnull
 */
export async function checkGroupMembership(userId: string, groupId: string): Promise<GroupMembership | null> {
  try {
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
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループメンバーシップを返す
     */
    return membership;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("[CHECK_GROUP_MEMBERSHIP]", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 一つでもグループオーナー権限があればtrueを返す
 * 通知のUIを決めるために必要
 */
export async function checkOneGroupOwner(userId: string): Promise<{ success: boolean; error?: string }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
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
  if (!userGroupMemberships) {
    return { success: false, error: "グループオーナー権限がありません" };
  } else {
    return { success: true };
  }
}
