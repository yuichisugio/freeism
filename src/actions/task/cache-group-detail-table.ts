"use cache";

import type { GroupDetailTask } from "@/types/group-types";
import type { Prisma } from "@prisma/client";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { useCacheKeys } from "@/library-setting/nextjs-use-cache";
import { prisma } from "@/library-setting/prisma";
import { ContributionType, TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getTasksByGroupId の props の型
 */
export type GetTasksByGroupIdProps = {
  groupId: string;
  page: number;
  sortField: string;
  sortDirection: string;
  searchQuery: string;
  contributionTypeFilter: "ALL" | ContributionType;
  statusFilter: TaskStatus | "ALL";
  itemPerPage: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * getTasksByGroupId の返り値の型
 */
export type GetGroupTaskAndCountReturn = {
  returnTasks: GroupDetailTask[];
  totalTaskCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループの詳細情報を取得する関数
 * @param groupId - グループID
 * @returns グループの詳細情報と総タスク数
 */
export async function getCachedGroupTaskAndCount(params: GetTasksByGroupIdProps): Promise<GetGroupTaskAndCountReturn> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータを取得
     */
    const { groupId, page, sortField, sortDirection, searchQuery, contributionTypeFilter, statusFilter, itemPerPage } =
      params;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * パラメータのチェック
     */
    if (
      !groupId ||
      !page ||
      !sortField ||
      !sortDirection ||
      !searchQuery ||
      (!Object.values(TaskStatus).includes(statusFilter as TaskStatus) && statusFilter !== "ALL") ||
      (!Object.values(ContributionType).includes(contributionTypeFilter as ContributionType) &&
        contributionTypeFilter !== "ALL") ||
      !itemPerPage
    ) {
      throw new Error("パラメータが不足しています");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの検索条件
     */
    const whereConditions: Prisma.TaskWhereInput = { groupId };

    // 検索クエリがある場合
    if (searchQuery) {
      whereConditions.task = {
        contains: searchQuery,
        mode: "insensitive", // 大文字・小文字を区別しない
      };
    }

    // 貢献タイプによる絞り込み条件を追加
    if (contributionTypeFilter !== "ALL") {
      whereConditions.contributionType = contributionTypeFilter;
    }

    // ステータスによる絞り込み条件を追加
    if (statusFilter !== "ALL") {
      whereConditions.status = statusFilter;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ソート条件
     */
    let orderBy: Prisma.TaskOrderByWithRelationInput = {};
    if (sortField == "taskFixedContributionPoint") {
      orderBy = { fixedContributionPoint: sortDirection as Prisma.SortOrder };
    } else {
      orderBy = { [sortField]: sortDirection as Prisma.SortOrder };
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの取得
     */
    const tasks = await prisma.task.findMany({
      where: whereConditions,
      orderBy,
      skip: (page - 1) * itemPerPage,
      take: itemPerPage,
      select: {
        // Task テーブルから必要なフィールドのみ選択
        id: true,
        task: true,
        detail: true,
        status: true,
        contributionType: true,
        fixedContributionPoint: true,
        fixedEvaluationLogic: true,
        createdAt: true,
        // 関連データも select で必要な部分のみ取得
        auction: {
          select: {
            id: true,
          },
        },
        fixedEvaluator: {
          select: {
            settings: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        creator: {
          select: {
            settings: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        reporters: {
          select: {
            user: {
              select: {
                settings: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
        executors: {
          select: {
            user: {
              select: {
                settings: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            maxParticipants: true,
            goal: true,
            evaluationMethod: true,
            depositPeriod: true,
            members: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクが見つからない場合
     */
    if (!tasks) {
      throw new Error("タスクが見つかりません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクを整形
     */
    const returnTasks: GroupDetailTask[] = tasks.map((task) => {
      const reporterIds = task.reporters.map((r) => r.user?.settings?.id).filter((id): id is string => id != null);
      const executorIds = task.executors.map((e) => e.user?.settings?.id).filter((id): id is string => id != null);
      const reporterNames = task.reporters
        .map((r) => r.user?.settings?.username)
        .filter((name): name is string => name != null && name !== "未設定");
      const executorNames = task.executors
        .map((e) => e.user?.settings?.username)
        .filter((name): name is string => name != null && name !== "未設定");

      return {
        id: task.id,
        auctionId: task.auction?.id ?? null,
        taskName: task.task,
        taskDetail: task.detail,
        taskStatus: task.status,
        taskContributionType: task.contributionType,
        taskFixedContributionPoint: task.fixedContributionPoint,
        taskFixedEvaluator: task.fixedEvaluator?.settings?.username ?? "未設定",
        taskFixedEvaluationLogic: task.fixedEvaluationLogic,
        taskCreator: task.creator.settings?.username ?? "未設定",
        taskReporterUserIds: reporterIds.length > 0 ? reporterIds : null,
        taskExecutorUserIds: executorIds.length > 0 ? executorIds : null,
        taskReporterUserNames: reporterNames.length > 0 ? reporterNames : null,
        taskExecutorUserNames: executorNames.length > 0 ? executorNames : null,
        createdAt: task.createdAt,
        group: {
          id: task.group.id,
          name: task.group.name,
          maxParticipants: task.group.maxParticipants,
          goal: task.group.goal,
          evaluationMethod: task.group.evaluationMethod,
          members: task.group.members.map((m) => ({ userId: m.userId })),
          depositPeriod: task.group.depositPeriod,
        },
      };
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの総数を取得
     */
    const totalTaskCount = await prisma.task.count({
      where: whereConditions,
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * キャッシュキーを取得
     */
    cacheTag(useCacheKeys.groupDetailTable.groupByGroupId(groupId).join(":"));

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * タスクの取得結果を返す
     */
    return { returnTasks, totalTaskCount };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("[GET_TASKS_BY_GROUP_ID]", error);
    throw new Error(
      `タスク情報の取得中にエラーが発生しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    );
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
