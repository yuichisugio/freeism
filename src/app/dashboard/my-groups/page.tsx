import type { Metadata } from "next";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ArrowUpDown } from "lucide-react";

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
    include: {
      group: true,
    },
    orderBy: {
      joinedAt: "desc",
    },
  });

  return (
    <MainTemplate
      title="参加Group一覧"
      description="参加しているグループ一覧を表示します"
    >
      {/* テーブル */}
      <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* テーブルヘッダー */}
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/50">
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    ID
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    GROUP NAME
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    参加人数
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    KPI
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    DESCRIPTION
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            {/* テーブルボディ */}
            <tbody>
              {memberships.map((membership, index) => (
                <tr
                  key={membership.id}
                  className="border-b border-blue-50 hover:bg-blue-50/50"
                >
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {index + 1}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium whitespace-nowrap text-blue-900">
                    {membership.group.name}
                  </td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {membership.group.maxParticipants}人
                  </td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {membership.group.evaluationMethod}
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-600">
                    {membership.group.goal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        <div className="flex items-center justify-between border-t border-blue-100 px-4 py-1">
          <div className="text-sm text-neutral-600">
            Showing 1-{memberships.length} of {memberships.length}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="text-neutral-600"
              disabled
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-neutral-600"
              disabled
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </MainTemplate>
  );
}
