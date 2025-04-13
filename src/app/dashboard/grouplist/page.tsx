import type { Metadata } from "next";
import Link from "next/link";
import { GroupListTable } from "@/components/group/group-list-table";
import { MainTemplate } from "@/components/layout/maintemplate";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Group一覧 - Freeism App",
  description: "グループ一覧を表示します",
};

export default async function GroupListPage() {
  const userId = await getAuthenticatedSessionUserId();

  // グループ一覧を取得（参加状況も含める）
  const groups = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      goal: true,
      evaluationMethod: true,
      maxParticipants: true,
      members: {
        where: {
          userId: userId,
        },
        select: {
          id: true,
        },
      },
      createdBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // グループがない場合は、グループがない旨を表示
  if (groups.length === 0) {
    return (
      <MainTemplate title="Group一覧" description="現在参加可能なグループ一覧を表示します">
        <div>グループがありません</div>
      </MainTemplate>
    );
  }

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
      <GroupListTable groups={groups} />
    </MainTemplate>
  );
}
