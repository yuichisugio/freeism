"use server";

import type { CreateGroupFormData } from "@/components/form/create-group-form";
import type { GetGroupMembers } from "@/types/group-types";
import { revalidatePath } from "next/cache";
import { checkGroupMembership, checkIsPermission } from "@/actions/permission/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { createGroupSchema } from "@/library-setting/zod-schema";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを作成する関数
 * @param data - 作成するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createGroup(data: CreateGroupFormData): Promise<{ success: boolean; error?: string }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証処理
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * バリデーション処理
     */
    const validatedData = createGroupSchema.parse(data);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループを作成する
     * 一緒にGroupMembershipのレコードも作成して、デフォで参加して、デフォでGroupを作成したユーザーをオーナーにする
     */
    await prisma.group.create({
      data: {
        ...validatedData,
        createdBy: userId,
        members: {
          create: {
            userId: userId,
            isGroupOwner: true,
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループ作成後のリフレッシュ
     */
    revalidatePath("/dashboard/group-list");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返す
     */
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    /**
     * エラー処理
     */
    // zodエラーをチェック。
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { success: false, error: "入力内容に誤りがあります" };
    }

    // Prismaの一意制約エラーをチェック
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      console.error("Unique constraint error:", error);
      return { success: false, error: "このグループ名は既に使用されています" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返す
     */
    console.error("createGroup unexpected error:", error);
    return { success: false, error: "エラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループに参加する関数
 * @param groupId - 参加するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function joinGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループIDがあるかチェック
     */
    if (!groupId) {
      throw new Error("グループIDがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証処理
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループの存在確認
     */
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error("グループが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 既に参加済みかチェック
     */
    const membership = await checkGroupMembership(userId, groupId);
    if (membership) {
      throw new Error("既に参加済みです");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 参加人数が上限に達している場合
     */
    const memberCount = await prisma.groupMembership.count({
      where: { groupId },
    });
    if (memberCount >= group.maxParticipants) {
      throw new Error("参加人数が上限に達しています");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループに参加
     */
    await prisma.groupMembership.create({
      data: {
        userId,
        groupId,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * リフレッシュ
     */
    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返す
     */
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラー処理
     */
  } catch (error) {
    console.error("joinGroup error:", error);
    return {
      success: false,
      error: `joinGroup中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを削除する関数
 * @param groupId - 削除するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループIDがあるかチェック
     */
    if (!groupId) {
      throw new Error("グループIDがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証処理
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループの存在確認
     */
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        createdBy: true,
      },
    });

    if (!group) {
      throw new Error("グループが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループの操作権限があるユーザーのみが削除可能
     */
    const isOwner = await checkIsPermission(userId, groupId, undefined, false);
    if (!isOwner.success) {
      throw new Error("グループの削除権限がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループを削除
     */
    await prisma.group.delete({
      where: { id: groupId },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * リフレッシュ
     */
    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返す
     */
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラー処理
     */
  } catch (error) {
    console.error("deleteGroup error:", error);
    return {
      success: false,
      error: `deleteGroup中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ名の重複をチェックする関数。
 * Groupテーブル名の重複チェックはユニーク制約があるので、↓は不要。
 * @param name - チェックするグループ名
 * @returns 重複している場合はtrue、していない場合はfalse
 */
export async function checkGroupExistByName(name: string): Promise<boolean> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ名があるかチェック
   */
  if (!name || name.trim() === "") {
    throw new Error("グループ名がありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ名の重複をチェック
   */
  const group = await prisma.group.findFirst({
    where: { name },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 重複している場合はtrue、していない場合はfalse
   */
  return !!group;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを編集する関数
 * @param groupId - 編集するグループのID
 * @param data - 編集するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateGroup(
  groupId: string,
  data: CreateGroupFormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループIDがあるかチェック
     */
    if (!groupId) {
      throw new Error("グループIDがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * データをバリデーション
     */
    const validatedData = createGroupSchema.parse(data);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証処理
     */
    const userId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループの作成者のみが編集可能
     */
    const isOwner = await checkIsPermission(userId, groupId, undefined, false);
    if (!isOwner.success) {
      throw new Error("グループの編集権限がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループの存在確認
     */
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        name: true,
      },
    });

    if (!group) {
      throw new Error("グループが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 同じ名前のグループが存在するかチェック（自分自身は除く）
     */
    if (data.name !== group.name) {
      const existingGroup = await prisma.group.findFirst({
        where: {
          name: data.name,
          NOT: {
            id: groupId,
          },
        },
      });

      /**
       * 同じ名前のグループが存在する場合
       */
      if (existingGroup) {
        throw new Error("このグループ名は既に使用されています");
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループを更新
     */
    await prisma.group.update({
      where: { id: groupId },
      data: validatedData,
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * リフレッシュ
     */
    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返す
     */
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラー処理
     */
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { success: false, error: "入力内容に誤りがあります" };
    }

    console.error("updateGroup error:", error);
    return {
      success: false,
      error: `updateGroup中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのメンバー一覧を取得する関数
 * @param groupId - 取得するグループのID
 * @returns グループメンバーの配列
 */
export async function getGroupMembers(groupId: string): Promise<GetGroupMembers[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループIDがあるかチェック
   */
  if (!groupId) {
    throw new Error("グループIDがありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーを取得
   */
  const members = await prisma.groupMembership.findMany({
    where: {
      groupId,
    },
    select: {
      isGroupOwner: true,
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
    orderBy: {
      joinedAt: "asc",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーを返す
   */
  const returnMembers: GetGroupMembers[] = members.map((member) => ({
    isGroupOwner: member.isGroupOwner,
    userId: member.user.id,
    appUserName: member.user.settings?.username ?? `未設定_${member.user.id}`,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーを返す
   */
  return returnMembers;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループからメンバーを削除する関数
 * @param groupId - グループID
 * @param userId - 削除するユーザーID
 * @param addToBlackList - ブラックリストに追加するかどうか
 * @returns 処理結果を含むオブジェクト
 */
export async function removeMember(
  groupId: string,
  userId: string,
  addToBlackList: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループIDがあるかチェック
     */
    if (!groupId || !userId || addToBlackList === undefined || addToBlackList === null) {
      throw new Error("グループIDまたはユーザーIDがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 認証処理
     */
    const currentUserId = await getAuthenticatedSessionUserId();

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 操作者がグループオーナーかチェック
     */
    const isOwner = await checkIsPermission(currentUserId, groupId, undefined, false);
    if (!isOwner.success) {
      throw new Error("グループメンバーを削除する権限がありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 対象ユーザーのメンバーシップ確認
     */
    const membership = await checkGroupMembership(userId, groupId);
    if (!membership) {
      throw new Error("指定されたユーザーはグループに参加していません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 操作者自身を削除対象にできないようにする
     */
    if (userId === currentUserId) {
      throw new Error("自分自身を削除することはできません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * オーナー権限を持つメンバーは削除できないようにする
     */
    if (membership.isGroupOwner) {
      throw new Error("グループオーナーを削除することはできません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * トランザクション処理
     */
    await prisma.$transaction(async (tx) => {
      // メンバーシップを削除
      await tx.groupMembership.delete({
        where: { id: membership.id },
      });

      // ブラックリストに追加する場合
      if (addToBlackList) {
        const group = await tx.group.findUnique({
          where: { id: groupId },
          select: { isBlackList: true },
        });

        const blackList = (group?.isBlackList as Record<string, boolean>) ?? {};
        blackList[userId] = true;

        await tx.group.update({
          where: { id: groupId },
          data: { isBlackList: blackList },
        });
      }
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * リフレッシュ
     */
    revalidatePath(`/dashboard/group/${groupId}`);

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 成功を返す
     */
    return { success: true };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラー処理
     */
  } catch (error) {
    console.error("removeMember error:", error);
    return {
      success: false,
      error: `メンバー削除中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}
