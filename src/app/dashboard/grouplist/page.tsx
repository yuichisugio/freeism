import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { GroupListTable } from "@/components/group/group-list-table";
import { MainTemplate } from "@/components/layout/maintemplate";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Group一覧 - Freeism App",
  description: "グループ一覧を表示します",
};

export default async function GroupListPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

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
          userId: session.user.id,
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

  return (
    <MainTemplate
      title="Group一覧"
      description="現在参加可能なグループ一覧を表示します"
      component={
        <Button asChild className="bg-app hover:bg-app/80 w-auto text-white">
          <Link href="/dashboard/create-group" className="flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            新規Group作成
          </Link>
        </Button>
      }
    >
      <GroupListTable groups={groups} />
    </MainTemplate>
  );
}
