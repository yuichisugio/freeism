"use cache";

import type { Prisma } from "@prisma/client";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import { TABLE_CONSTANTS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ一覧の総数を取得する関数
 * @returns グループ一覧の総数
 */
export async function getCachedTotalGroupCount() {
  /**
   * キャッシュタグを設定
   * */
  cacheTag("groupList");
  cacheLife("hours");
  return await prisma.group.count();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ一覧とメンバー数を取得する関数
 * @returns グループ一覧とメンバー数
 */
export async function getCachedGroupList(page: number, sortField: string, sortDirection: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュタグを設定
   * */
  cacheTag("groupList");
  cacheLife("hours");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * sortの条件
   */
  let orderBy: Prisma.GroupOrderByWithRelationInput;
  if (sortField === "currentParticipants") {
    orderBy = {
      members: {
        _count: sortDirection as Prisma.SortOrder,
      },
    };
  } else if (sortField === "isJoined") {
    orderBy = {
      createdAt: sortDirection as Prisma.SortOrder,
    };
  } else {
    orderBy = {
      [sortField]: sortDirection as Prisma.SortOrder,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧を取得
   * */
  const groupsData = await prisma.group.findMany({
    skip: (page - 1) * TABLE_CONSTANTS.ITEMS_PER_PAGE,
    take: TABLE_CONSTANTS.ITEMS_PER_PAGE,
    select: {
      id: true,
      name: true,
      goal: true,
      evaluationMethod: true,
      maxParticipants: true,
      depositPeriod: true,
      user: {
        select: {
          settings: {
            select: {
              username: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
    orderBy: orderBy,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * グループ一覧のデータを整える
   * */
  const groups = groupsData.map((group) => ({
    id: group.id,
    name: group.name,
    goal: group.goal,
    evaluationMethod: group.evaluationMethod,
    maxParticipants: group.maxParticipants,
    depositPeriod: group.depositPeriod,
    createdBy: group.user?.settings?.username ?? "未設定",
    joinMembersCount: group._count.members,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  /**
   * グループ一覧を返す
   * */
  return groups;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
