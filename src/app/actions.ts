"use server";

import type { SetupForm } from "@/components/auth/setup-form";
import type { CreateGroupFormData } from "@/components/group/create-group-form";
import type { TaskFormValues } from "@/components/group/task-input-form";
import type { TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createGroupSchema, setupSchema, taskFormSchema } from "@/lib/zod-schema";
import { z } from "zod";

/**
 * ユーザー設定を更新または作成する関数
 * @param data - フォームから送信されたデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateUserSetup(data: SetupForm) {
  try {
    // 認証セッションを取得
    const session = await auth();
    // ユーザーが認証されていない場合
    if (!session?.user?.id) {
      return { success: false, error: "ユーザーが認証されていません。" };
    }

    const validatedData = setupSchema.parse(data);
    console.log("validatedData", validatedData);

    // フォームの回答内容をデータベースに保存する。更新or新規作成
    await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
      create: {
        userId: session.user.id,
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
    });

    // 保存が成功した場合
    return { success: true, redirect: "/dashboard/grouplist" };
  } catch (error) {
    // エラーログを出力
    console.error("Error updating user setup:", error);
    return { success: false, error: "設定の更新中にエラーが発生しました。" };
  }
}

/**
 * グループを作成する関数
 * @param data - 作成するグループのデータ
 * @returns 処理結果を含むオブジェクト
 */
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
      },
    });

    console.log("createGroup success");

    revalidatePath("/dashboard/grouplist");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return { error: "入力内容に誤りがあります" };
    }
    console.error("1111createGroup unexpected error:", error);
    return { error: "エラーが発生しました" };
  }
}

/**
 * グループに参加する関数
 * @param groupId - 参加するグループのID
 * @returns 処理結果を含むオブジェクト
 */
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

    console.log("group", group);

    if (!group) {
      return { error: "グループが見つかりません" };
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
 * @param groupId - 削除するグループのID
 * @returns 処理結果を含むオブジェクト
 */
export async function deleteGroup(groupId: string) {
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

    // グループの作成者のみが削除可能
    if (group.createdBy !== session.user.id) {
      return { error: "グループの削除権限がありません" };
    }

    // グループを削除
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
 * タスクを作成する関数
 * @param data - タスクのデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function createTask(data: TaskFormValues, groupId: string) {
  try {
    // 認証セッションを取得
    const session = await auth();

    // 認証セッションが取得できない場合
    if (!session?.user?.id) {
      return { error: "認証エラーが発生しました" };
    }

    // バリデーション
    if (!data || !groupId) {
      return { error: "必須項目が入力されていません" };
    }

    // タスクを作成
    const newTask = await prisma.task.create({
      data: {
        task: data.task,
        reference: data.reference,
        contributionType: data.contributionType,
        userId: session.user.id,
        groupId: groupId,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/group/${groupId}`);
    return { success: true, task: newTask };
  } catch (error) {
    console.error("[CREATE_TASK]", error);
    return { error: "タスクの作成中にエラーが発生しました" };
  }
}

/**
 * グループの詳細情報を取得する関数
 * @param groupId - グループID
 * @returns グループの詳細情報
 */
export async function getTasksByGroupId(groupId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            maxParticipants: true,
            goal: true,
            evaluationMethod: true,
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

    if (!tasks) {
      throw new Error("タスクが見つかりません");
    }

    return tasks;
  } catch (error) {
    console.error("[GET_TASKS_BY_GROUP_ID]", error);
    throw new Error("タスク情報の取得中にエラーが発生しました");
  }
}

/**
 * グループのTask情報をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @returns CSVデータ
 */
export async function exportGroupTask(groupId: string) {
  try {
    const tasks = await prisma.task.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
        group: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!tasks) {
      throw new Error("タスクが見つかりません");
    }

    // タスクのユーザー名を取得。taskひとつが要素の配列なので、全部を.mapで繰り返して加工している
    const formattedTasks = tasks.map((task) => ({
      ...task,
      user: task.user.name,
    }));

    return formattedTasks;
  } catch (error) {
    console.error("[EXPORT_GROUP_TASK]", error);
    throw new Error("グループのTask情報のエクスポート中にエラーが発生しました");
  }
}

/**
 * CSVからタスクを一括登録する関数
 * @param data - CSVから読み込んだタスクデータ
 * @param groupId - グループID
 * @param userId - ユーザーID
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkCreateTasks(data: any[], groupId: string) {
  try {
    // 認証セッションを取得
    const session = await auth();

    // 認証セッションが取得できない場合
    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    // トランザクションを使用してデータを一括登録
    const result = await prisma.$transaction(async (tx) => {
      // タスクを作成
      const tasks = await Promise.all(
        data.map(async (row) => {
          // タスクを作成
          const task = await tx.task.create({
            data: {
              task: row.task,
              reference: row.reference,
              contributionType: "NON_REWARD",
              userId: session.user?.id || "",
              groupId: groupId,
            },
            // 、関連するuserオブジェクトから、ユーザーのnameのみを選択して取得しています。これにより、後続の処理でタスク作成後にユーザー名を利用したい場合に、余分なデータを省いて効率的にアクセスすることができます。
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          });
          return task;
        }),
      );
      return tasks;
    });

    return { success: true, tasks: result };
  } catch (error) {
    console.error("[BULK_CREATE_TASKS]", error);
    return { error: "タスクの一括登録中にエラーが発生しました" };
  }
}

/**
 * CSVから貢献評価を一括登録する関数
 * @param data - CSVから読み込んだ評価データ
 * @param groupId - グループID
 * @returns 処理結果を含むオブジェクト
 */
export async function bulkCreateEvaluations(data: any[], groupId: string) {
  try {
    // 認証セッションを取得
    const session = await auth();

    // 認証セッションが取得できない場合
    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    // トランザクションを使用してデータを一括登録
    const result = await prisma.$transaction(async (tx) => {
      const evaluations = await Promise.all(
        data.map(async (row) => {
          // タスクを更新
          const task = await tx.task.update({
            where: { id: row.taskId },
            data: {
              status: "TASK_COMPLETED",
              contributionPoint: parseInt(row.contributionPoint),
              evaluator: session.user?.id || "",
              evaluationLogic: row.evaluationLogic,
            },
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          });
          return task;
        }),
      );
      return evaluations;
    });

    return { success: true, evaluations: result };
  } catch (error) {
    console.error("[BULK_CREATE_EVALUATIONS]", error);
    return { error: "貢献評価の一括登録中にエラーが発生しました" };
  }
}

/**
 * タスクのステータスを更新する関数
 * @param taskId - 更新するタスクのID
 * @param status - 新しいステータス
 * @returns 処理結果を含むオブジェクト
 */
export async function updateTaskStatus(taskId: string, status: string) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("認証エラーが発生しました");
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status: status as TaskStatus },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidatePath(`/dashboard/group/${updatedTask.groupId}`);
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("[UPDATE_TASK_STATUS]", error);
    return { error: "タスクのステータスの更新中にエラーが発生しました" };
  }
}
