import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTasksByGroupId } from "@/app/actions/task";
import { GroupDetail } from "@/components/group/group-detail";
import { GroupDetailSkeleton } from "@/components/group/group-detail-skeleton";
import { MainTemplate } from "@/components/layout/maintemplate";

export const metadata: Metadata = {
  title: "グループ詳細 - Freeism App",
  description: "グループの詳細を表示します",
};

type GroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  // パラメータを取得
  const { id } = await params;

  // グループの詳細を取得
  const tasks = await getTasksByGroupId(id);

  // グループが見つからない場合は404エラーを返す
  if (!tasks) {
    notFound();
  }

  return (
    <MainTemplate title={false} description={false}>
      <Suspense fallback={<GroupDetailSkeleton />}>
        <GroupDetail tasks={tasks} />
      </Suspense>
    </MainTemplate>
  );
}
