"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkGroupMembership } from "@/actions/permission/permission";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getUserJoinGroupAndCountのpropsの型
 */
export type GetUserJoinGroupAndCountProps = {
  page: number;
  sortField: string;
  sortDirection: string;
  searchQuery: string;
  itemPerPage: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ一覧・ユーザーの参加しているグループ一覧を取得する関数
 * userごとなので、サーバー側でキャッシュしない
 * TanStack QueryのuseQueryで使用するため、一つの関数にまとめる。
 * @returns グループ一覧
 */
export async function getUserJoinGroupAndCount({
  page,
  sortField,
  sortDirection,
  searchQuery,
  itemPerPage,
}: GetUserJoinGroupAndCountProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (!page || !sortField || !sortDirection || !searchQuery || !itemPerPage) {
    throw new Error("Invalid parameters");
  }

  /**
   * 認証処理
   */
  const userId = await getAuthenticatedSessionUserId();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧と総数を取得
   */
  const [returnUserJoinGroupList, userJoinGroupTotalCount] = await Promise.all([
    getUserJoinGroup(page, sortField, sortDirection, searchQuery, userId, itemPerPage),
    getUserJoinGroupCount(searchQuery, userId),
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーの参加しているグループ一覧と総数を返す
   */
  return { returnUserJoinGroupList, userJoinGroupTotalCount };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧を取得する関数
 * .lengthではLIMITの件数しか返ってこないのでCountとして使えない
 * @returns ユーザーの参加しているグループ一覧
 */
export async function getUserJoinGroup(
  page: number,
  sortField: string,
  sortDirection: string,
  searchQuery: string,
  userId: string,
  itemPerPage: number,
) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (!userId || !page || !sortField || !sortDirection || !searchQuery || !itemPerPage) {
    throw new Error("ユーザーIDがありません");
  }

  /**
   * グループ一覧のsortの条件
   */
  let orderBy: Prisma.GroupPointOrderByWithRelationInput;
  if (sortField === "groupPointBalance") {
    orderBy = {
      balance: sortDirection as Prisma.SortOrder,
    };
  } else if (sortField === "groupPointFixedTotalPoints") {
    orderBy = {
      fixedTotalPoints: sortDirection as Prisma.SortOrder,
    };
  } else if (sortField === "groupDepositPeriod") {
    orderBy = {
      group: {
        depositPeriod: sortDirection as Prisma.SortOrder,
      },
    };
  } else {
    orderBy = {
      group: {
        [sortField]: sortDirection as Prisma.SortOrder,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧のwhereの条件
   */
  let where: Prisma.GroupPointWhereInput = {
    group: {
      members: {
        some: {
          userId: userId,
        },
      },
    },
  };

  // 検索クエリがある場合
  if (searchQuery) {
    where = {
      ...where,
      group: {
        name: {
          contains: searchQuery,
        },
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーの参加しているグループ一覧を取得
   */
  const userJoinGroup = await prisma.groupPoint.findMany({
    where: where,
    skip: (page - 1) * itemPerPage,
    take: itemPerPage,
    orderBy: orderBy,
    select: {
      group: {
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          depositPeriod: true,
          members: {
            select: {
              isGroupOwner: true,
            },
            where: {
              userId: userId,
            },
          },
        },
      },
      balance: true,
      fixedTotalPoints: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧を整える
   */
  const returnUserJoinGroupList = userJoinGroup.map((group) => ({
    id: group.group.id,
    groupName: group.group.name,
    groupGoal: group.group.goal,
    groupEvaluationMethod: group.group.evaluationMethod,
    groupDepositPeriod: group.group.depositPeriod,
    groupPointBalance: group.balance,
    groupPointFixedTotalPoints: group.fixedTotalPoints,
    isGroupOwner: group.group.members[0]?.isGroupOwner ?? false,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧を返す
   */
  return returnUserJoinGroupList;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧の総数を取得する関数
 * @returns ユーザーの参加しているグループ一覧の総数
 */
export async function getUserJoinGroupCount(searchQuery: string | null, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (!userId) {
    throw new Error("ユーザーIDがありません");
  }

  /**
   * グループ一覧のwhereの条件
   */
  let where: Prisma.GroupWhereInput = {
    members: {
      some: {
        userId: userId,
      },
    },
  };

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
   * ユーザーの参加しているグループ一覧の総数を取得
   */
  const userJoinGroupTotalCount = await prisma.group.count({
    where: where,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーの参加しているグループ一覧の総数を返す
   */
  return userJoinGroupTotalCount;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループから脱退する関数
 * @param groupId - 脱退するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function leaveGroup(groupId: string) {
  try {
    if (!groupId) {
      throw new Error("グループIDがありません");
    }

    // 認証処理
    const userId = await getAuthenticatedSessionUserId();

    // メンバーシップの存在確認
    const membership = await checkGroupMembership(userId, groupId);
    if (!membership) {
      return { success: false, message: "グループに参加していません" };
    }

    // グループから脱退
    await prisma.groupMembership.delete({
      where: {
        id: membership.id,
      },
    });

    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");
    return { success: true, message: "グループから脱退しました" };
  } catch (error) {
    console.error("[LEAVE_GROUP]", error);
    return {
      success: false,
      message: `グループから脱退中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
