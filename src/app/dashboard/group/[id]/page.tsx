import { Suspense } from "react";
import { GroupDetail } from "@/components/group/group-detail";
import { GroupDetailSkeleton } from "@/components/group/group-detail-skeleton";
import { MainTemplate } from "@/components/layout/maintemplate";

type GroupDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  // パラメータを取得
  const { id } = await params;

  return (
    <MainTemplate title="グループ詳細" description="グループの詳細を表示します">
      <div className="container py-6">
        <Suspense fallback={<GroupDetailSkeleton />}>
          <GroupDetail groupId={id} />
        </Suspense>
      </div>
    </MainTemplate>
  );
}
