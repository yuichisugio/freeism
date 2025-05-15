"use cache";

import type { Metadata } from "next";
import { Suspense } from "react";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { GroupDetail } from "@/components/group/group-detail";
import { GroupDetailSkeleton } from "@/components/group/group-detail-skeleton";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "グループ詳細 - Freeism App",
  description: "グループの詳細を表示します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページ
 * @param params パラメータ
 */
export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュの有効期間を設定
   */
  cacheLife("max");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータを取得
   */
  const { id } = await params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ詳細ページを返す
   */
  return (
    <MainTemplate title={false} description={false}>
      <Suspense fallback={<GroupDetailSkeleton />}>
        <GroupDetail groupId={id} />
      </Suspense>
    </MainTemplate>
  );
}
