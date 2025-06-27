"use server";

import type { GroupAnalyticsExportReturn } from "./cache-export-group-analytics";
import { cachedExportGroupAnalytics } from "./cache-export-group-analytics";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループの分析結果をCSV形式でエクスポートする関数
 * @param groupId - グループID
 * @param page - 取得するページ番号（1ページ200件）
 * @param onlyFixed - FIX済みの分析結果のみを取得するフラグ
 * @param onlyTaskCompleted - TASK_COMPLETEDステータスのタスクのみを取得するフラグ（分析用）
 * @returns 評価者ごとに分けられたCSVデータ
 */
export async function exportGroupAnalytics(
  groupId: string,
  page = 1,
  onlyFixed = false,
  onlyTaskCompleted = false,
): Promise<GroupAnalyticsExportReturn> {
  return cachedExportGroupAnalytics(groupId, page, onlyFixed, onlyTaskCompleted);
}
