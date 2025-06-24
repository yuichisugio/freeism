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
export async function createGroup(data: CreateGroupFormData) {
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
     */
    await prisma.group.create({
      data: {
        ...validatedData,
        createdBy: userId,
        members: {
          //一緒にGroupMembershipのレコードも作成して、デフォで参加して、デフォでGroupを作成したユーザーをオーナーにする
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
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { error: "入力内容に誤りがあります" };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラーを返す
     */
    console.error("createGroup unexpected error:", error);
    return { error: "エラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループに参加する関数
 * @param groupId - 参加するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function joinGroup(groupId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  try {
    // 認証処理
    const userId = await getAuthenticatedSessionUserId();

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // 既に参加済みかチェック
    const membership = await checkGroupMembership(userId, groupId);
    if (membership) {
      return { error: "既に参加済みです" };
    }

    // 参加人数が上限に達している場合
    const memberCount = await prisma.groupMembership.count({
      where: { groupId },
    });
    if (memberCount >= group.maxParticipants) {
      return { error: "参加人数が上限に達しています" };
    }

    // グループに参加
    await prisma.groupMembership.create({
      data: {
        userId,
        groupId,
      },
    });

    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[JOIN_GROUP]", error);
    return { error: "エラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを削除する関数
 * @param groupId - 削除するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteGroup(groupId: string) {
  try {
    // 認証処理
    const userId = await getAuthenticatedSessionUserId();

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // グループの作成者のみが削除可能
    if (group.createdBy !== userId) {
      return { error: "グループの削除権限がありません" };
    }

    // グループを削除
    await prisma.group.delete({
      where: { id: groupId },
    });

    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_GROUP]", error);
    return { error: "グループの削除中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ名の重複をチェックする関数。
 * Groupテーブル名の重複チェックはユニーク制約があるので、↓は不要。
 * @param name - チェックするグループ名
 * @returns 重複している場合はtrue、していない場合はfalse
 */
export async function checkGroupExistByName(name: string) {
  try {
    const group = await prisma.group.findFirst({
      where: { name },
    });
    return !!group;
  } catch (error) {
    console.error("[CHECK_GROUP_NAME]", error);
    throw error;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを編集する関数
 * @param groupId - 編集するグループのID
 * @param data - 編集するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateGroup(groupId: string, data: CreateGroupFormData) {
  try {
    // 認証処理
    const userId = await getAuthenticatedSessionUserId();

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // グループの作成者のみが編集可能
    if (group.createdBy !== userId) {
      return { error: "グループの編集権限がありません" };
    }

    // 同じ名前のグループが存在するかチェック（自分自身は除く）
    if (data.name !== group.name) {
      const existingGroup = await prisma.group.findFirst({
        where: {
          name: data.name,
          NOT: {
            id: groupId,
          },
        },
      });

      if (existingGroup) {
        return { error: "このグループ名は既に使用されています" };
      }
    }

    const validatedData = createGroupSchema.parse(data);

    // グループを更新
    await prisma.group.update({
      where: { id: groupId },
      data: validatedData,
    });

    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { error: "入力内容に誤りがあります" };
    }
    console.error("[UPDATE_GROUP]", error);
    return { error: "グループの更新中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのメンバー一覧を取得する関数
 * @param groupId - 取得するグループのID
 * @returns グループメンバーの配列
 */
export async function getGroupMembers(groupId: string): Promise<GetGroupMembers[]> {
  try {
    const members = await prisma.groupMembership.findMany({
      where: {
        groupId,
      },
      select: {
        isGroupOwner: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    const returnMembers: GetGroupMembers[] = members.map((member) => ({
      isGroupOwner: member.isGroupOwner,
      userId: member.user.id,
      appUserName: member.user.name ?? "未設定",
    }));

    return returnMembers;
  } catch (error) {
    console.error("[GET_GROUP_MEMBERS]", error);
    throw error;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループからメンバーを削除する関数
 * @param groupId - グループID
 * @param userId - 削除するユーザーID
 * @param addToBlackList - ブラックリストに追加するかどうか
 * @returns 処理結果を含むオブジェクト
 */
export async function removeMember(groupId: string, userId: string, addToBlackList: boolean) {
  try {
    // 認証処理
    const currentUserId = await getAuthenticatedSessionUserId();

    // 操作者がグループオーナーかチェック
    const isOwner = await checkIsPermission(currentUserId, groupId);
    if (!isOwner.success) {
      return { error: "グループメンバーを削除する権限がありません" };
    }

    // 対象ユーザーのメンバーシップ確認
    const membership = await checkGroupMembership(userId, groupId);
    if (!membership) {
      return { error: "指定されたユーザーはグループに参加していません" };
    }

    // 操作者自身を削除対象にできないようにする
    if (userId === currentUserId) {
      return { error: "自分自身を削除することはできません" };
    }

    // オーナー権限を持つメンバーは削除できないようにする
    if (membership.isGroupOwner) {
      return { error: "グループオーナーを削除することはできません" };
    }

    // トランザクション処理
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

    revalidatePath(`/dashboard/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("[REMOVE_MEMBER]", error);
    return { error: "メンバー削除中にエラーが発生しました" };
  }
}
