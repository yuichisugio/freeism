"use server";

import type { GetGroupTaskAndCountReturn, GetTasksByGroupIdProps } from "./cache-group-detail-table";
import { getCachedGroupTaskAndCount } from "./cache-group-detail-table";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループの詳細情報を取得する関数
 * @param groupId - グループID
 * @returns グループの詳細情報と総タスク数
 */
export async function getGroupTaskAndCount(params: GetTasksByGroupIdProps): Promise<GetGroupTaskAndCountReturn> {
  return await getCachedGroupTaskAndCount(params);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
