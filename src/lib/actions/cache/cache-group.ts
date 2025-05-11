"use cache";

import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ一覧とメンバー数を取得する関数
 * @returns グループ一覧とメンバー数
 */
export async function getCachedGroupList() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュタグを設定
   * */
  cacheTag("groupList");
  cacheLife("hours");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * グループ一覧を取得
   * */
  const groupsData = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      goal: true,
      evaluationMethod: true,
      maxParticipants: true,
      depositPeriod: true,
      createdBy: true,
      _count: {
        select: {
          members: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * グループ一覧とメンバー数を返す
   * */
  const groups = groupsData.map((group) => ({
    ...group,
    joinMembersCount: group._count.members,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * グループ一覧を返す
   * */
  return groups;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
