"use server";

import type { CreateGroupFormData } from "@/components/form/create-group-form";
import type { GetGroupMembers } from "@/types/group-types";
import { revalidatePath } from "next/cache";
import { checkGroupMembership, checkIsPermission } from "@/actions/permission/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";
import { createGroupSchema } from "@/library-setting/zod-schema";
import { type PromiseResult } from "@/types/general-types";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを作成する関数
 * @param data - 作成するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createGroup(data: CreateGroupFormData): PromiseResult<null> {
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
    return { success: true, message: "グループを作成しました", data: null };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    /**
     * エラー処理
     */
    // zodエラーをチェック。
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { success: false, message: "入力内容に誤りがあります", data: null };
    }

    // Prismaの一意制約エラーをチェック
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      console.error("Unique constraint error:", error);
      return { success: false, message: "このグループ名は既に使用されています", data: null };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返す
     */
    console.error("createGroup unexpected error:", error);
    throw new Error(`createGroup中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループに参加する関数
 * @param groupId - 参加するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function joinGroup(groupId: string): PromiseResult<null> {
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
  if (membership.success && membership.data) {
    return {
      success: false,
      message: "既に参加済みです",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 参加人数が上限に達している場合
   */
  const memberCount = await prisma.groupMembership.count({
    where: { groupId },
  });
  if (memberCount >= group.maxParticipants) {
    return {
      success: false,
      message: "参加人数が上限に達しています",
      data: null,
    };
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
  return { success: true, message: "グループに参加しました", data: null };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを削除する関数
 * @param groupId - 削除するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteGroup(groupId: string): PromiseResult<null> {
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
    return {
      success: false,
      message: "グループの削除権限がありません",
      data: null,
    };
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
  return { success: true, message: "グループを削除しました", data: null };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ名の重複をチェックする関数。
 * Groupテーブル名の重複チェックはユニーク制約があるので、↓は不要。
 * @param name - チェックするグループ名
 * @returns 重複している場合はtrue、していない場合はfalse
 */
export async function checkGroupExistByName(name: string): PromiseResult<boolean> {
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
  return { success: true, message: "グループ名の重複をチェックしました", data: !!group };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを編集する関数
 * @param groupId - 編集するグループのID
 * @param data - 編集するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateGroup(groupId: string, data: CreateGroupFormData): PromiseResult<null> {
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
    return {
      success: false,
      message: "グループの編集権限がありません",
      data: null,
    };
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
  return { success: true, message: "グループを更新しました", data: null };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのメンバー一覧を取得する関数
 * @param groupId - 取得するグループのID
 * @returns グループメンバーの配列
 */
export async function getGroupMembers(groupId: string): PromiseResult<GetGroupMembers[]> {
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
  return { success: true, message: "グループメンバーを取得しました", data: returnMembers };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループからメンバーを削除する関数
 * @param groupId - グループID
 * @param removeUserId - 削除するユーザーID
 * @param addToBlackList - ブラックリストに追加するかどうか
 * @returns 処理結果を含むオブジェクト
 */
export async function removeMember(
  groupId: string,
  removeUserId: string,
  addToBlackList: boolean,
): PromiseResult<null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループIDがあるかチェック
   */
  if (!groupId || !removeUserId || addToBlackList === undefined || addToBlackList === null) {
    throw new Error("invalid parameters");
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
    return {
      success: false,
      message: "グループメンバーを削除する権限がありません",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 対象ユーザーのメンバーシップ確認
   */
  const membership = await checkGroupMembership(removeUserId, groupId);
  if (!membership.success || !membership.data) {
    return {
      success: false,
      message: "指定されたユーザーはグループに参加していません",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 操作者自身を削除対象にできないようにする
   */
  if (removeUserId === currentUserId) {
    return {
      success: false,
      message: "自分自身を削除することはできません",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * オーナー権限を持つメンバーは削除できないようにする
   */
  if (membership.data?.isGroupOwner) {
    return {
      success: false,
      message: "グループオーナーを削除することはできません",
      data: null,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * トランザクション処理
   */
  await prisma.$transaction(async (tx) => {
    // メンバーシップを削除
    await tx.groupMembership.delete({
      where: { id: membership.data?.id },
    });

    // ブラックリストに追加する場合
    if (addToBlackList) {
      const group = await tx.group.findUnique({
        where: { id: groupId },
        select: { isBlackList: true },
      });

      const blackList = (group?.isBlackList as Record<string, boolean>) ?? {};
      blackList[removeUserId] = true;

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
  return { success: true, message: "メンバーを削除しました", data: null };
}
