"use server";

import type { CreateGroupFormData } from "@/components/group/create-group-form";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/zod-schema";
import { z } from "zod";

/**
 * グループを作成する関数
 * @param data - 作成するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createGroup(data: CreateGroupFormData) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      console.log("createGroup error", "認証エラーが発生しました");
      return { error: "認証エラーが発生しました" };
    }

    const validatedData = createGroupSchema.parse(data);

    await prisma.group.create({
      data: {
        ...validatedData,
        createdBy: session.user.id,
        members: {
          //一緒にGroupMembershipのレコードも作成して、デフォで参加して、デフォでGroupを作成したユーザーをオーナーにする
          create: {
            userId: session.user.id,
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

/**
 * グループに参加する関数
 * @param groupId - 参加するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function joinGroup(groupId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // ブラックリストチェック
    const blackList = group.isBlackList as Record<string, boolean> | null;
    if (blackList && blackList[session.user.id]) {
      return { error: "このグループに参加する権限がありません" };
    }

    // 既に参加済みの場合
    if (group.members.length > 0) {
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
        userId: session.user.id,
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

/**
 * グループから脱退する関数
 * @param groupId - 脱退するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function leaveGroup(groupId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // メンバーシップの存在確認
    const membership = await prisma.groupMembership.findFirst({
      where: {
        userId: session.user.id,
        groupId,
      },
    });

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

/**
 * グループを削除する関数
 * onDelete: Cascadeの設定により、グループを削除するとそれに関連するデータ（GroupMembership, Task, Analyticsなど）も自動的に削除されます
 * @param groupId - 削除するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteGroup(groupId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // ユーザーがグループオーナーかチェック
    const membership = await prisma.groupMembership.findFirst({
      where: {
        userId: session.user.id,
        groupId,
      },
    });

    if (!membership) {
      return { error: "グループに参加していません" };
    }

    if (!membership.isGroupOwner) {
      return { error: "グループの削除権限がありません" };
    }

    // グループを削除 (関連データは自動的に削除される - onDelete: Cascade)
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

/**
 * グループを編集する関数
 * @param groupId - 編集するグループのID
 * @param data - 編集するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateGroup(groupId: string, data: CreateGroupFormData) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // グループの存在確認と作成者チェック
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // グループの作成者のみが編集可能
    if (group.createdBy !== session.user.id) {
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

/**
 * グループオーナー権限を付与する関数
 * @param groupId - 権限を付与するグループのID
 * @param userId - 権限を付与するユーザーのID
 * @returns 処理結果を含むオブジェクト
 */
export async function grantOwnerPermission(groupId: string, userId: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // 操作者がグループオーナーかチェック
    const operatorMembership = await prisma.groupMembership.findFirst({
      where: {
        userId: session.user.id,
        groupId,
        isGroupOwner: true,
      },
    });

    if (!operatorMembership) {
      return { error: "グループオーナー権限がありません" };
    }

    // 対象ユーザーのグループメンバーシップを取得
    const targetMembership = await prisma.groupMembership.findFirst({
      where: {
        userId,
        groupId,
      },
    });

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

type GroupMembership = {
  id: string;
  userId: string;
  groupId: string;
  isGroupOwner: boolean;
  joinedAt: Date;
};

/**
 * グループのメンバー一覧を取得する関数
 * @param groupId - 取得するグループのID
 * @returns グループメンバーの配列
 */
export async function getGroupMembers(groupId: string) {
  try {
    const members: GroupMembership[] = await prisma.groupMembership.findMany({
      where: {
        groupId,
      },
      include: {
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

    return members;
  } catch (error) {
    console.error("[GET_GROUP_MEMBERS]", error);
    throw error;
  }
}

/**
 * Groupオーナー権限を持っているかチェックする関数
 * @param groupId - 取得するグループのID
 * @param userId - 取得するユーザーのID
 * @returns グループメンバーの配列
 */
export async function checkGroupOwner(groupId: string, userId: string) {
  try {
    const membership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId,
        isGroupOwner: true,
      },
    });

    return !!membership;
  } catch (error) {
    console.error("[CHECK_GROUP_OWNER]", error);
    throw error;
  }
}

/**
 * グループメンバーを除名する関数
 * @param groupId - グループのID
 * @param userId - 除名するユーザーのID
 * @param addToBlackList - ブラックリストに追加するかどうか
 * @returns 処理結果を含むオブジェクト
 */
export async function removeMember(groupId: string, userId: string, addToBlackList: boolean) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // グループの存在確認
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return { error: "グループが見つかりません" };
    }

    // 操作者がグループオーナーかチェック
    const operatorMembership = await prisma.groupMembership.findFirst({
      where: {
        userId: session.user.id,
        groupId,
      },
    });

    if (!operatorMembership) {
      return { error: "グループに参加していません" };
    }

    if (!operatorMembership.isGroupOwner) {
      return { error: "メンバー除名の権限がありません" };
    }

    // 除名対象メンバーの存在確認
    const targetMembership = await prisma.groupMembership.findFirst({
      where: {
        userId,
        groupId,
      },
    });

    if (!targetMembership) {
      return { error: "指定されたメンバーはグループに参加していません" };
    }

    // 操作者自身を除名対象にできないようにする
    if (userId === session.user.id) {
      return { error: "自分自身を除名することはできません" };
    }

    // オーナー権限を持つメンバーは除名できないようにする
    if (targetMembership.isGroupOwner) {
      return { error: "グループオーナーを除名することはできません" };
    }

    // メンバーをグループから除名
    await prisma.groupMembership.delete({
      where: {
        id: targetMembership.id,
      },
    });

    // ブラックリストに追加する場合
    if (addToBlackList) {
      // 現在のブラックリスト取得
      const currentBlackList = (group.isBlackList as Record<string, boolean> | null) || {};

      // 新しいブラックリストを作成
      const newBlackList = {
        ...currentBlackList,
        [userId]: true,
      };

      // RawSQLを使用してJSONBフィールドを更新
      await prisma.$executeRaw`
        UPDATE "Group"
        SET "isBlackList" = ${JSON.stringify(newBlackList)}::jsonb
        WHERE id = ${groupId}
      `;
    }

    revalidatePath(`/dashboard/group/${groupId}`);
    return { success: true };
  } catch (error) {
    console.error("[REMOVE_MEMBER]", error);
    return { error: "メンバー除名中にエラーが発生しました" };
  }
}
