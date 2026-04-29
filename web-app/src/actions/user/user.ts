"use server";

import type { TaskParticipant } from "@/types/group-types";
import { getCachedAllUsers } from "@/actions/user/cache-user";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 全ユーザーの一覧を取得する関数
 * @returns ユーザー一覧
 */
export async function getAllUsers(): PromiseResult<TaskParticipant[]> {
  return await getCachedAllUsers();
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
