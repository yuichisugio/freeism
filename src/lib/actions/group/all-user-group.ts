"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getAllUserGroupsAndCountのpropsの型
 */
type getAllUserGroupsAndCountProps = {
  page: number;
  sortField: string;
  sortDirection: string;
  searchQuery: string;
  isJoined: "true" | "false" | null;
  itemPerPage: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ一覧・ユーザーの参加しているグループ一覧を取得する関数
 * userごとなので、サーバー側でキャッシュしない
 * TanStack QueryのuseQueryで使用するため、一つの関数にまとめる。
 * @returns グループ一覧
 */
export async function getAllUserGroupsAndCount({
  page,
  sortField,
  sortDirection,
  searchQuery,
  isJoined,
  itemPerPage,
}: getAllUserGroupsAndCountProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 認証処理
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧と総数を取得
   */
  const [AllUserGroupList, AllUserGroupTotalCount] = await Promise.all([
    getAllUserGroups(page, sortField, sortDirection, searchQuery, isJoined, userId, itemPerPage),
    getAllUserGroupsCount(searchQuery, isJoined, userId),
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧を返す
   */
  return { AllUserGroupList, AllUserGroupTotalCount };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧を取得する関数
 * @returns ユーザーの参加しているグループ一覧
 */
export async function getAllUserGroups(
  page: number,
  sortField: string,
  sortDirection: string,
  searchQuery: string,
  isJoined: "true" | "false" | null,
  userId: string,
  itemPerPage: number,
) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧のsortの条件
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
      createdAt: "desc",
    };
  } else {
    orderBy = {
      [sortField]: sortDirection as Prisma.SortOrder,
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧のwhereの条件
   */
  let where: Prisma.GroupWhereInput = {};
  // 参加しているグループの場合
  if (isJoined === "true") {
    where = {
      members: {
        some: {
          userId: userId,
        },
      },
    };
  } else if (isJoined === "false") {
    // 参加していないグループの場合
    where = {
      members: {
        none: {
          userId: userId,
        },
      },
    };
  }

  // 検索クエリがある場合
  if (searchQuery) {
    where = {
      ...where,
      name: {
        contains: searchQuery,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧を取得
   * */
  const prismaReturnGroups = await prisma.group.findMany({
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
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
      members: {
        where: {
          userId: userId,
        },
        select: {
          id: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
    orderBy: orderBy,
    where: where,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧のデータを整える
   * */
  const AllUserGroupList = prismaReturnGroups.map((group) => ({
    id: group.id,
    name: group.name,
    goal: group.goal,
    evaluationMethod: group.evaluationMethod,
    maxParticipants: group.maxParticipants,
    depositPeriod: group.depositPeriod,
    createdBy: group.user?.settings?.username ?? "未設定",
    joinMembersCount: group._count.members,
    isJoined: group.members.length > 0,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧の総数を取得
   */
  const AllUserGroupTotalCount = prismaReturnGroups.length;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データ取得のデバッグ用
   */
  console.log("src/lib/actions/group.ts_AllUserGroupList", AllUserGroupList);
  console.log("src/lib/actions/group.ts_AllUserGroupTotalCount", AllUserGroupTotalCount);

  return AllUserGroupList;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧の総数を取得する関数
 * @returns ユーザーの参加しているグループ一覧の総数
 */
export async function getAllUserGroupsCount(searchQuery: string, isJoined: "true" | "false" | null, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧のwhereの条件
   */
  let where: Prisma.GroupWhereInput = {};
  // 参加しているグループの場合
  if (isJoined === "true") {
    where = {
      members: {
        some: {
          userId: userId,
        },
      },
    };
  } else if (isJoined === "false") {
    // 参加していないグループの場合
    where = {
      members: {
        none: {
          userId: userId,
        },
      },
    };
  }

  // 検索クエリがある場合
  if (searchQuery) {
    where = {
      ...where,
      name: {
        contains: searchQuery,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return prisma.group.count({
    where: where, // 修正：isJoinedに応じたwhere条件を使用
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
