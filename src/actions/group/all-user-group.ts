"use server";

import type { AllUserGroupTable } from "@/types/group-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/library-setting/prisma";
import { sortDirectionArray } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getAllUserGroupsAndCountのpropsの型
 */
type getAllUserGroupsProps = {
  page: number;
  sortField: string;
  sortDirection: string;
  searchQuery: string | null;
  isJoined: (typeof isJoinedArray)[number];
  itemPerPage: number;
  userId: string;
};
const isJoinedArray = ["isJoined", "notJoined", "all"] as const;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧を取得する関数
 * @returns ユーザーの参加しているグループ一覧
 */
export async function getAllUserGroups({
  page,
  sortField,
  sortDirection,
  searchQuery,
  isJoined,
  userId,
  itemPerPage,
}: getAllUserGroupsProps): Promise<AllUserGroupTable[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (
    !page ||
    page < 1 ||
    !sortField ||
    !sortDirection ||
    !sortDirectionArray.includes(sortDirection) ||
    !itemPerPage ||
    itemPerPage < 1 ||
    !userId ||
    !isJoinedArray.includes(isJoined)
  ) {
    throw new Error("Invalid parameters");
  }

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
  if (isJoined === "isJoined") {
    where = {
      members: {
        some: {
          userId: userId,
        },
      },
    };
  } else if (isJoined === "notJoined") {
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
  const AllUserGroupList: AllUserGroupTable[] = prismaReturnGroups.map((group) => ({
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
   * グループ一覧を返す
   */
  return AllUserGroupList;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧の総数を取得する関数
 * @returns ユーザーの参加しているグループ一覧の総数
 */
export async function getAllUserGroupsCount(
  searchQuery: string | null,
  isJoined: (typeof isJoinedArray)[number],
  userId: string,
): Promise<number> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (!userId || !isJoinedArray.includes(isJoined)) {
    throw new Error("Invalid parameters");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧のwhereの条件
   */
  let where: Prisma.GroupWhereInput = {};
  // 参加しているグループの場合
  if (isJoined === "isJoined") {
    where = {
      members: {
        some: {
          userId: userId,
        },
      },
    };
  } else if (isJoined === "notJoined") {
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
   * グループ一覧の総数を取得
   */
  const count = await prisma.group.count({
    where: where,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧の総数を返す
   */
  return count;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
