import type { Metadata } from "next";
import { MyGroupsTable } from "@/components/group/my-groups-table";
import { MainTemplate } from "@/components/layout/maintemplate";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * メタデータ
 */
export const metadata: Metadata = {
  title: "参加Group一覧 - Freeism App",
  description: "参加しているグループ一覧を表示します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 参加Group一覧ページ
 */
export default async function MyGroupsPage() {
  const userId = await getAuthenticatedSessionUserId();

  // 参加しているグループ一覧を取得
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: userId,
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
              executors: {
                some: {
                  userId: userId,
                },
              },
            },
            select: {
              fixedContributionPoint: true,
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
