"use client";

import { useState } from "react";
import { joinGroup } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, UserPlus } from "lucide-react";
import { toast } from "sonner";

// グループのデータの型を定義
type Group = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  members: { id: string }[];
};

// 各要素がグループのデータの配列を、groupsキーに格納したオブジェクトの型を定義
type GroupListTableProps = {
  groups: Group[];
};

// 各要素のデータとしてグループデータが入ったオブジェクトを引数として渡す
export function GroupListTable({ groups: initialGroups }: GroupListTableProps) {
  // 初期値としてpropsに渡したグループのデータ(groupsキーに配列で格納)を取得したグループデータを格納する
  const [groups, setGroups] = useState(initialGroups);

  // ソートの設定を格納。現在のソート設定をオブジェクト(キーは、key:とdirection:)で保持。
  // key:は、keyofでGroup型のオブジェクトのキー名をリテラルで取得したリテラル型。Group型のどのキーを基準にソートするか
  // direction:は、ソートの方向で、"asc"（昇順）か "desc"（降順）のどちらかを持ちます。
  // 初期状態はオブジェクトではなく、 null として設定されています。
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Group;
    direction: "asc" | "desc";
  } | null>(null);

  // ソート関数。引数はGroup型のキー名のどれかをしか受け付けないリテラル型。
  // 指定したGroup型の中のキーで、降順/昇順で、sortする
  function sortData(key: keyof Group) {
    // 初期値ascで、ソートの並べ方を保存
    let direction: "asc" | "desc" = "asc";
    // ソート設定があり、かつキーが同じ、かつ方向が同じ場合は降順にソートする
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    // ソート設定を更新。レンダリングされるたびにdirectionが初期化されるので、渡す必要がない。
    setSortConfig({ key, direction });
    // ソートしたデータを格納。現在のgroups配列をスプレッド構文でコピーし、元の配列を直接変更しないようにしています。
    const sortedData = [...groups].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1; // 方向が "asc" なら -1 を返し、"desc" なら 1 を返すことで、正しい順序に並び替えます。
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1; // 方向が "asc" なら 1 を返し、"desc" なら -1 を返すことで、逆の順序に並び替えます。
      return 0;
    });

    // ソート後の配列 sortedData を groups 状態にセットします。これにより、UI も再レンダリングされ、新しい順序が反映されます。
    setGroups(sortedData);
  }

  // グループ参加処理
  async function handleJoin(groupId: string) {
    try {
      // グループに参加する。
      const result = await joinGroup(groupId);

      if (result.success) {
        toast.success("グループに参加しました");
        // 参加状態を更新。prevは現在のstate。
        setGroups((prev) =>
          // グループを一つずつチェック。
          prev.map((group) =>
            // チェックしたグループのidが、設定したハンドラーのgroupIdと同じ場合は、参加者を追加。
            group.id === groupId
              ? // 同じ場合は、参加者を追加。
                { ...group, members: [{ id: "temp" }] }
              : // 同じでない場合は、そのままのグループを返す。
                group,
          ),
        );
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
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <span className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                    参加
                  </span>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button
                    onClick={() => sortData("name")}
                    className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600"
                  >
                    GROUP NAME
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button
                    onClick={() => sortData("maxParticipants")}
                    className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600"
                  >
                    参加人数
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button
                    onClick={() => sortData("evaluationMethod")}
                    className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600"
                  >
                    KPI
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-sm font-medium text-blue-900">
                  <button
                    onClick={() => sortData("goal")}
                    className="inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600"
                  >
                    DESCRIPTION
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </button>
                </th>
              </tr>
            </thead>

            {/* テーブルボディ */}
            <tbody>
              {groups.map((group) => (
                <tr
                  key={group.id}
                  className="border-b border-blue-50 hover:bg-blue-50/50"
                >
                  <td className="px-5 py-3 text-sm whitespace-nowrap">
                    {/* AlertDialogTrigger を使って、ダイアログを開くトリガーとする */}
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-app hover:bg-app/10"
                        // memberは自分のデータしか取得しないようにしているため、0以上でデータが一つあれば参加していることになる。
                        disabled={group.members.length > 0}
                      >
                        <UserPlus className="mr-1 h-4 w-4" />
                        {group.members.length > 0 ? "参加中" : "参加"}
                      </Button>
                    </AlertDialogTrigger>
                    {/* AlertDialogContent 内で「参加する」アクションに handleJoin を実行 */}
                    <AlertDialogContent>
                      <AlertDialogHeader className="text-app">
                        <AlertDialogTitle>
                          グループに参加しますか？
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          グループに参加すると、グループのメンバーとして参加できます。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          asChild
                          className="bg-app hover:bg-app/90 text-white"
                        >
                          <Button onClick={() => handleJoin(group.id)}>
                            参加する
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium whitespace-nowrap text-blue-900">
                    {group.name}
                  </td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {group.maxParticipants}人
                  </td>
                  <td className="px-5 py-3 text-sm whitespace-nowrap text-neutral-600">
                    {group.evaluationMethod}
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-600">
                    {group.goal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        <div className="flex items-center justify-between border-t border-blue-100 px-4 py-1">
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
    </AlertDialog>
  );
}
