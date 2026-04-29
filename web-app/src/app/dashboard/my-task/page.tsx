"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { MainTemplate } from "@/components/layout/maintemplate";
import { MyTaskTableComponent } from "@/components/task/my-task-table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "My Task一覧 - Freeism App",
  description: "自分のタスク一覧を表示します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ログインしているユーザーのタスク一覧を表示するページ
 */
export default async function MyTasksPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を最大に設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 自分のタスク一覧を表示するページ
   */
  return (
    <MainTemplate
      title="My Task一覧"
      description="自分のタスク一覧を表示します"
      component={
        <Button asChild className="button-default-custom w-auto self-start text-white sm:self-center">
          <Link href="/dashboard/create-task" className="flex items-center">
            <PlusCircle className="mr-2 h-4 w-4" />
            新規Task作成
          </Link>
        </Button>
      }
    >
      <MyTaskTableComponent />
    </MainTemplate>
  );
}
