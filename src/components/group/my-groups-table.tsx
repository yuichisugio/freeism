"use client";

import { useState } from "react";
import { leaveGroup } from "@/app/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, LogOut } from "lucide-react";
import { toast } from "sonner";

type GroupMembership = {
  id: string;
  group: {
    id: string;
    name: string;
    goal: string;
    evaluationMethod: string;
    maxParticipants: number;
  };
};

type MyGroupsTableProps = {
  memberships: GroupMembership[];
};

export function MyGroupsTable({ memberships: initialMemberships }: MyGroupsTableProps) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof GroupMembership["group"];
    direction: "asc" | "desc";
  } | null>(null);

  // ソート関数
  function sortData(key: keyof GroupMembership["group"]) {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedData = [...memberships].sort((a, b) => {
      if (a.group[key] < b.group[key]) return direction === "asc" ? -1 : 1;
      if (a.group[key] > b.group[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setMemberships(sortedData);
  }

  // グループ脱退処理
  async function handleLeave(groupId: string) {
    try {
      const result = await leaveGroup(groupId);

      if (result.success) {
        toast.success("グループから脱退しました");
        // 脱退したグループを一覧から削除
        setMemberships((prev) => prev.filter((membership) => membership.group.id !== groupId));
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  return (
    <AlertDialog>
      <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* テーブルヘッダー */}
            <thead>
              <tr className="border-b border-blue-100 bg-blue-50/50">
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <span className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">脱退</span>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortData("name")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    GROUP NAME
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortData("maxParticipants")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    参加人数
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortData("evaluationMethod")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    KPI
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium">
                  <button onClick={() => sortData("goal")} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    DESCRIPTION
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>
            {/* テーブルボディ */}
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id} className="border-b border-blue-50 hover:bg-blue-50/50">
                  <td className="px-5 py-3 text-sm whitespace-nowrap">
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
                        <LogOut className="mr-1 h-4 w-4" />
                        脱退
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>グループから脱退しますか？</AlertDialogTitle>
                        <AlertDialogDescription>グループから脱退すると、再度参加するまでグループの活動に参加できなくなります。</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button onClick={() => handleLeave(membership.group.id)} className="bg-red-600 text-white hover:bg-red-700">
                            脱退する
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </td>
                  <td className="text-app px-5 py-3 text-sm font-medium whitespace-nowrap">{membership.group.name}</td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{membership.group.maxParticipants}人</td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">{membership.group.evaluationMethod}</td>
                  <td className="px-5 py-3 text-sm text-neutral-600">{membership.group.goal}</td>
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
            <Button variant="outline" size="sm" className="text-neutral-600" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="text-neutral-600" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
    </AlertDialog>
  );
}
