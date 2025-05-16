"use server";

import type { TaskParticipant } from "@/types/group-types";
import { getCachedAllUsers } from "@/lib/actions/cache/cache-user";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 全ユーザーの一覧を取得する関数
 * @returns ユーザー一覧
 */
export async function getAllUsers(): Promise<TaskParticipant[]> {
  const users = await getCachedAllUsers();
  return users;
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
