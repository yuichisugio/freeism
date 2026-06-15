"use cache";

import type { TaskParticipant } from "@/types/group-types";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 全ユーザーの一覧を取得する関数
 * @returns ユーザー一覧
 */
export async function getCachedAllUsers(): PromiseResult<TaskParticipant[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 全ユーザーの一覧を取得
   */
  const users = await prisma.user.findMany({
    select: {
      settings: {
        select: {
          username: true,
        },
      },
      id: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー一覧を返す
   */
  const returnUsers = users.map((user) => ({
    appUserId: user.id,
    appUserName: user.settings?.username ?? `未設定_${user.id}`,
  }));

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー一覧を返す
   */
  return {
    success: true,
    message: "ユーザー一覧を取得しました",
    data: returnUsers,
  };
}
