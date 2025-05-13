"use server";

import type { CreateGroupFormData } from "@/components/group/create-group-form";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { createGroupSchema } from "@/lib/zod-schema";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧を取得する関数
 * @returns ユーザーの参加しているグループ一覧
 */
export async function getUserJoinGroupData() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 認証処理
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーの参加しているグループ一覧を取得
   */
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      group: {
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          maxParticipants: true,
          tasks: {
            where: {
              executors: {
                some: {
                  userId: userId,
                },
              },
            },
            select: {
              fixedContributionPoint: true,
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  return memberships;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループを作成する関数
 * @param data - 作成するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createGroup(data: CreateGroupFormData) {
  try {
    // 認証処理
    const userId = await getAuthenticatedSessionUserId();

    const validatedData = createGroupSchema.parse(data);

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

    revalidatePath("/dashboard/grouplist");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { error: "入力内容に誤りがあります" };
    }
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

    revalidatePath("/dashboard/grouplist");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[JOIN_GROUP]", error);
    return { error: "エラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループから脱退する関数
 * @param groupId - 脱退するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function leaveGroup(groupId: string) {
  try {
    // 認証処理
    const userId = await getAuthenticatedSessionUserId();

    // メンバーシップの存在確認
    const membership = await checkGroupMembership(userId, groupId);
    if (!membership) {
      return { error: "グループに参加していません" };
    }

    // グループから脱退
    await prisma.groupMembership.delete({
      where: {
        id: membership.id,
      },
    });

    revalidatePath("/dashboard/grouplist");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[LEAVE_GROUP]", error);
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

    revalidatePath("/dashboard/grouplist");
    revalidatePath("/dashboard/my-groups");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_GROUP]", error);
    return { error: "グループの削除中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ名の重複をチェックする関数。Groupテーブル名の重複チェックはユニーク制約があるので、↓は不要。
 * @param name - チェックするグループ名
 * @returns 重複している場合はtrue、していない場合はfalse
 */
export async function checkGroupNameExists(name: string) {
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

    revalidatePath("/dashboard/grouplist");
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
 * グループの詳細を取得する関数
 * @param groupId - 取得するグループのID
 * @returns グループの詳細情報
 */
export async function getGroup(groupId: string) {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return null;
    }

    return group;
  } catch (error) {
    console.error("[GET_GROUP]", error);
    throw error;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アプリオーナー権限をチェックする関数
 * @param userId - チェックするユーザーのID
 * @returns アプリオーナー権限があればtrue、なければfalse
 */
export async function checkAppOwner(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAppOwner: true },
    });

    return user?.isAppOwner ?? false;
  } catch (error) {
    console.error("[CHECK_APP_OWNER]", error);
    return false;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加チェックを行う関数
 * @param userId - チェックするユーザーのID
 * @param groupId - チェックするグループのID
 * @returns グループメンバーシップ、存在しない場合はnull
 */
export async function checkGroupMembership(userId: string, groupId: string) {
  try {
    const membership = await prisma.groupMembership.findFirst({
      where: {
        userId,
        groupId,
      },
    });
    return membership;
  } catch (error) {
    console.error("[CHECK_GROUP_MEMBERSHIP]", error);
    return null;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * オーナー権限があるかどうかをチェックする関数
 * @param userId - チェックするユーザーのID
 * @param groupId - チェックするグループのID
 * @returns グループオーナーの場合はtrue、それ以外はfalse
 */
export async function checkGroupOwner(userId: string, groupId: string) {
  try {
    //Appオーナー権限があるかチェック
    const appOwner = await prisma.user.findFirst({
      where: {
        id: userId,
        isAppOwner: true,
      },
    });
    if (appOwner) {
      return true;
    }
    //Groupオーナー権限があるかチェック
    const membership = await prisma.groupMembership.findFirst({
      where: {
        userId,
        groupId,
        isGroupOwner: true,
      },
    });
    return !!membership;
  } catch (error) {
    console.error("[CHECK_GROUP_OWNER]", error);
    return false;
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループオーナー権限を付与する関数
 * @param groupId - 権限を付与するグループのID
 * @param userId - 権限を付与するユーザーのID
 * @returns 処理結果を含むオブジェクト
 */
export async function grantOwnerPermission(groupId: string, userId: string) {
  try {
    // 操作者がグループオーナーかチェック
    const isOwner = await checkGroupOwner(userId, groupId);
    if (!isOwner) {
      return { error: "グループオーナー権限がありません" };
    }

    // 対象ユーザーのグループメンバーシップを取得
    const targetMembership = await checkGroupMembership(userId, groupId);
    if (!targetMembership) {
      return { error: "指定されたユーザーはグループに参加していません" };
    }

    // 既にオーナー権限を持っている場合
    if (targetMembership.isGroupOwner) {
      return { error: "指定されたユーザーは既にグループオーナーです" };
    }

    // グループオーナー権限を付与
    await prisma.groupMembership.update({
      where: {
        id: targetMembership.id,
      },
      data: {
        isGroupOwner: true,
      },
    });

    revalidatePath(`/dashboard/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("[GRANT_OWNER_PERMISSION]", error);
    return { error: "グループオーナー権限の付与中にエラーが発生しました" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーシップの型定義
 */
export type GroupMembership = {
  id: string;
  userId: string;
  groupId: string;
  isGroupOwner: boolean;
  joinedAt: Date;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーの型定義（ユーザー情報を含む）
 */
export type GroupMemberWithUser = GroupMembership & {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのメンバー一覧を取得する関数
 * @param groupId - 取得するグループのID
 * @returns グループメンバーの配列
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberWithUser[]> {
  try {
    const members = await prisma.groupMembership.findMany({
      where: {
        groupId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    return members;
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
    const isOwner = await checkGroupOwner(currentUserId, groupId);
    if (!isOwner) {
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
