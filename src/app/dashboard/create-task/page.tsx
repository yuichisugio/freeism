"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { MainTemplate } from "@/components/layout/maintemplate";
import { CreateTaskForm } from "@/components/task/create-task-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "新規Task作成 - Freeism App",
  description: "新規タスクを作成します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 新規Task作成ページ
 * @param searchParams グループID
 * @returns 新規Task作成ページ
 */
export default async function CreateTaskPage({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループID
   */
  const params = await searchParams;
  const groupId = params.groupId;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 新規Task作成ページ
   * @returns 新規Task作成ページ
   */
  return (
    <MainTemplate title="新規Task作成" description="新規タスクを作成します">
      <CreateTaskForm groupId={groupId ?? null} />
    </MainTemplate>
  );
}
