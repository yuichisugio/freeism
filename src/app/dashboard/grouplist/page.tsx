"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { GroupListTable } from "@/components/group/group-list-table";
import { MainTemplate } from "@/components/layout/maintemplate";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "Group一覧 - Freeism App",
  description: "グループ一覧を表示します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ一覧ページ
 */
export default async function GroupListPage() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <MainTemplate
      title="Group一覧"
      description="現在参加可能なグループ一覧を表示します"
      component={
        // Tailwind の self-start クラスは、個々のフレックスアイテムに対して、親コンテナの align-items の stretch を上書きして、自身の内容に基づくサイズ（または自分の望む位置）に合わせるように指示します。
        // sm:self-center は、画面幅が小さい場合（smクラスが適用される）は、self-startになり、画面幅が大きい場合（smクラスが適用されない）は、self-centerになります。
        <Button asChild className="button-default-custom w-auto self-start text-white sm:self-center">
          <Link href="/dashboard/create-group" className="flex items-center">
            <Plus className="h-4 w-4" />
            新規Group作成
          </Link>
        </Button>
      }
    >
      <GroupListTable />
    </MainTemplate>
  );
}
