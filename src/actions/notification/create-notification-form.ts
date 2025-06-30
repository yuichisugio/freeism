"use server";

import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// ユーザー情報の型定義
export type UserForForm = {
  id: string;
  name: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知作成フォームを準備する
 */
export async function prepareCreateNotificationForm(isAppOwner: boolean, isGroupOwner: boolean, userId: string) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (
    isAppOwner === undefined ||
    isGroupOwner === undefined ||
    userId === undefined ||
    isAppOwner === null ||
    isGroupOwner === null ||
    userId === null
  ) {
    throw new Error("Invalid parameters");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー一覧を取得
   * アプリオーナーの場合のみ
   */
  let users: UserForForm[] = [];
  if (isAppOwner) {
    const usersFromDb = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        settings: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    users = usersFromDb.map((user) => ({
      id: user.id,
      name: user.settings?.username ?? user.name ?? "未設定",
    }));
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ一覧を取得
   */
  let groups: { id: string; name: string }[] = [];
  // アプリオーナーの場合は全てのグループを取得
  if (isAppOwner) {
    groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    // グループオーナーの場合は自分がオーナーのグループを取得
  } else if (isGroupOwner) {
    groups = await prisma.group.findMany({
      where: {
        members: {
          every: {
            userId: userId,
            isGroupOwner: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスク一覧を取得
   */
  let tasks: { id: string; task: string }[] = [];
  // アプリオーナーの場合は全てのタスクを取得
  if (isAppOwner) {
    tasks = await prisma.task.findMany({
      select: {
        id: true,
        task: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    // グループオーナーの場合は自分がオーナーのグループのタスクを取得
  } else if (isGroupOwner) {
    tasks = await prisma.task.findMany({
      where: {
        group: {
          members: {
            every: {
              userId: userId,
              isGroupOwner: true,
            },
          },
        },
      },
      select: {
        id: true,
        task: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * データを返す
   */
  return { users, groups, tasks };
}
