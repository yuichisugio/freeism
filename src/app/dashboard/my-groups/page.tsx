import type { Metadata } from "next";
import { auth } from "@/auth";
import { MyGroupsTable } from "@/components/group/my-groups-table";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "参加Group一覧 - Freeism App",
  description: "参加しているグループ一覧を表示します",
};

export default async function MyGroupsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // 参加しているグループ一覧を取得
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      group: {
        select: {
          id: true,
          name: true,
          goal: true,
          evaluationMethod: true,
          maxParticipants: true,
          tasks: {
            where: {
              userId: session.user.id,
            },
            select: {
              contributionPoint: true,
            },
          },
        },
      },
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  return (
    <MainTemplate title="参加Group一覧" description="参加しているグループ一覧を表示します">
      <MyGroupsTable memberships={memberships} />
    </MainTemplate>
  );
}
