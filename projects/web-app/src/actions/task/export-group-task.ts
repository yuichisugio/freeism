"use server";

import { type PromiseResult } from "@/types/general-types";

import type { GroupTaskCsvDataItem } from "./cache-export-group-task";
import { cachedExportGroupTask } from "./cache-export-group-task";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのタスク情報をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param startDate - 開始日
 * @param endDate - 終了日
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns CSV形式のタスク情報
 */
export async function exportGroupTask(
  groupId: string,
  startDate?: Date,
  endDate?: Date,
  onlyTaskCompleted = false,
): PromiseResult<GroupTaskCsvDataItem[]> {
  return cachedExportGroupTask(groupId, startDate, endDate, onlyTaskCompleted);
}
