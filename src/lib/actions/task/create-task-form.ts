"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成フォームのデータを取得
 * @param groupId グループID
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
