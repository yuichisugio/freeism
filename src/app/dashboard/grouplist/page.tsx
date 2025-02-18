import type { Group } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { MainTemplate } from "@/components/layout/maintemplate";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { ArrowUpDown, Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Group一覧 - Freeism App",
  description: "グループ一覧を表示します",
};

export default async function GroupListPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // グループ一覧を取得
  const groups = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      goal: true,
      evaluationMethod: true,
      maxParticipants: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <MainTemplate
      title="Group一覧"
      description="現在参加可能なグループ一覧を表示します"
    >
      <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
        <Link href="/dashboard/create-group">
          <Plus className="mr-2 h-4 w-4" />
          新規Group作成
        </Link>
      </Button>

      {/* テーブル */}
      <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* テーブルヘッダー */}
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex items-center hover:text-blue-600">
                    ID
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex items-center hover:text-blue-600">
                    GROUP NAME
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex items-center hover:text-blue-600">
                    参加人数
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex items-center hover:text-blue-600">
                    KPI
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-blue-900">
                  <button className="inline-flex items-center hover:text-blue-600">
                    DESCRIPTION
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            {/* テーブルボディ */}
            <tbody>
              {groups.map((group, index) => (
                <tr
                  key={group.id}
                  className="border-b border-blue-50 hover:bg-blue-50/50"
                >
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-blue-900">
                    {group.name}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {group.maxParticipants}人
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {group.evaluationMethod}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {group.goal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        <div className="flex items-center justify-between border-t border-blue-100 px-4 py-3">
          <div className="text-sm text-neutral-600">
            Showing 1-{groups.length} of {groups.length}
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
