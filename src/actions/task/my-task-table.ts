"use server";

import type { MyTaskTable, MyTaskTableConditions } from "@/types/group-types";
import { prisma } from "@/library-setting/prisma";
import { type Prisma } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type GetMyTaskDataReturn = {
  tasks: MyTaskTable[];
  totalTaskCount: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーのタスクを取得
 * @param tableConditions テーブルの表示条件（ソート、フィルター、ページネーション）
 * @returns ユーザーのタスクと総件数
 */
export async function getMyTaskData(
  tableConditions: MyTaskTableConditions,
  userId: string,
): Promise<GetMyTaskDataReturn> {
  try {
    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーIDとテーブルの表示条件のチェック
     */
    if (!userId || !tableConditions) {
      throw new Error("ユーザーID or テーブルの表示条件が指定されていません");
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * テーブルの表示条件を取得
     */
    const { page, sort, searchQuery, taskStatus, contributionType, itemPerPage } = tableConditions;

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * フィルター条件の構築
     */
    const whereConditions: Prisma.TaskWhereInput = {
      OR: [
        { creatorId: userId },
        { reporters: { some: { userId: userId } } },
        { executors: { some: { userId: userId } } },
      ],
    };

    // 検索条件
    if (searchQuery) {
      whereConditions.task = {
        contains: searchQuery,
        mode: "insensitive",
      };
    }

    // タスクステータス条件
    if (taskStatus && taskStatus !== "ALL") {
      whereConditions.status = taskStatus;
    }

    // タスク貢献タイプ条件
    if (contributionType && contributionType !== "ALL") {
      whereConditions.contributionType = contributionType;
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ソート条件の構築
     */
    // デフォルトソート
    let orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: "desc" };

    // ソート条件
    if (sort) {
      const { field, direction } = sort;
      const sortDirection = direction as Prisma.SortOrder;

      if (field === "taskName") {
        orderBy = { task: sortDirection };
      } else if (field === "groupName") {
        orderBy = { group: { name: sortDirection } };
      } else if (field === "taskStatus") {
        orderBy = { status: sortDirection };
      } else if (field === "taskFixedContributionPoint") {
        orderBy = { fixedContributionPoint: sortDirection };
      } else if (field === "taskFixedEvaluator") {
        orderBy = { fixedEvaluator: { settings: { username: sortDirection } } };
      } else if (field === "taskFixedEvaluationLogic") {
        orderBy = { fixedEvaluationLogic: sortDirection };
      } else if (field === "id") {
        orderBy = { id: sortDirection };
      } else if (field === "taskCreatorName") {
        orderBy = { creator: { settings: { username: sortDirection } } };
      } else if (field === "auctionId") {
        orderBy = { createdAt: sortDirection };
      }
    }

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * ユーザーのタスクを取得（作成者、報告者、実行者のいずれかが自分のタスク）
     */
    const tasksData = await prisma.task.findMany({
      where: whereConditions,
      orderBy: orderBy,
      skip: (page - 1) * itemPerPage,
      take: itemPerPage,
      select: {
        id: true,
        task: true,
        detail: true,
        status: true,
        contributionType: true,
        fixedContributionPoint: true,
        fixedEvaluator: {
          select: {
            settings: {
              select: {
                username: true,
              },
            },
          },
        },
        fixedEvaluationLogic: true,
        creator: {
          select: {
            settings: {
              select: {
                username: true,
              },
            },
          },
        },
        reporters: {
          select: {
            userId: true,
            user: {
              select: {
                settings: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
        executors: {
          select: {
            userId: true,
            user: {
              select: {
                settings: {
                  select: {
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
          },
        },
        auction: {
          select: {
            id: true,
          },
        },
      },
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * MyTaskTable型にマッピング
     */
    const formattedTasks: MyTaskTable[] = tasksData.map((task) => ({
      id: task.id,
      taskName: task.task,
      taskDetail: task.detail,
      taskStatus: task.status,
      taskContributionType: task.contributionType,
      taskFixedContributionPoint: task.fixedContributionPoint,
      taskFixedEvaluator: task.fixedEvaluator?.settings?.username ?? "未設定",
      taskFixedEvaluationLogic: task.fixedEvaluationLogic,
      taskCreatorName: task.creator?.settings?.username ?? "未設定",
      taskReporterUserIds: task.reporters.map((r) => r.userId).filter((id): id is string => id != null),
      taskExecutorUserIds: task.executors.map((e) => e.userId).filter((id): id is string => id != null),
      taskReporterUserNames: task.reporters
        .map((r) => r.user?.settings?.username)
        .filter((name): name is string => name != null && name !== "未設定")
        .join(", "),
      taskExecutorUserNames: task.executors
        .map((e) => e.user?.settings?.username)
        .filter((name): name is string => name != null && name !== "未設定")
        .join(", "),
      reporters: task.reporters.map((r) => ({
        appUserName: r.user?.settings?.username ?? null,
        appUserId: r.userId ?? null,
      })),
      executors: task.executors.map((e) => ({
        appUserName: e.user?.settings?.username ?? null,
        appUserId: e.userId ?? null,
      })),
      groupId: task.group.id,
      groupName: task.group.name,
      auctionId: task.auction?.id ?? null,
      group: { id: task.group.id, name: task.group.name },
    }));

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * 総件数を取得
     */
    const totalTaskCount = await prisma.task.count({
      where: whereConditions,
    });

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

    /**
     * データを返す
     */
    return { tasks: formattedTasks, totalTaskCount };

    // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  } catch (error) {
    console.error("[GET_MY_TASK_DATA]", error);
    throw new Error("タスク情報の取得中にエラーが発生しました");
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
