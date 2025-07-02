"use server";

import type { SortDirection } from "@/types/auction-types";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { checkGroupMembership } from "@/actions/permission/permission";
import { prisma } from "@/library-setting/prisma";
import { sortDirectionArray } from "@/types/auction-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getUserJoinGroupAndCountのpropsの型
 */
export type GetUserJoinGroupProps = {
  page: number;
  sortField: string;
  sortDirection: SortDirection;
  searchQuery: string;
  itemPerPage: number;
  userId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加しているグループ一覧を取得する関数
 * .lengthではLIMITの件数しか返ってこないのでCountとして使えない
 * @returns ユーザーの参加しているグループ一覧
 */
export async function getUserJoinGroup(props: GetUserJoinGroupProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの取得
   */
  const { page, sortField, sortDirection, searchQuery, itemPerPage, userId } = props;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (
    !userId ||
    !page ||
    page < 1 ||
    !sortField ||
    !sortDirectionArray.includes(sortDirection) ||
    !itemPerPage ||
    itemPerPage < 1
  ) {
    throw new Error("Invalid parameters");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  /**
   * パラメータの検証
   */
  if (!userId) {
    throw new Error("ユーザーIDがありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 検索クエリがある場合
  if (searchQuery && searchQuery.trim() !== "") {
    where = {
      ...where,
      name: {
        contains: searchQuery,
      },
    };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
export async function leaveGroup(groupId: string, userId: string) {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータの検証
     */
    if (!groupId) {
      throw new Error("グループIDがありません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * メンバーシップの存在確認
     */
    const membership = await checkGroupMembership(userId, groupId);
    if (!membership) {
      throw new Error("グループに参加していません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * グループから脱退
     */
    await prisma.groupMembership.delete({
      where: {
        id: membership.id,
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パスを再検証
     */
    revalidatePath("/dashboard/group-list");
    revalidatePath("/dashboard/my-groups");

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 処理結果を返す
     */
    return { success: true, message: "グループから脱退しました" };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * エラー処理
     */
  } catch (error) {
    console.error("[LEAVE_GROUP]", error);
    return {
      success: false,
      message: `グループから脱退中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
