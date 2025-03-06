"use client";

import type { Column, DataTableProps } from "@/components/share/data-table";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkGroupOwner, deleteGroup, getGroupMembers, grantOwnerPermission, joinGroup, removeMember } from "@/app/actions/group";
import { exportGroupTask } from "@/app/actions/task";
import { CsvUploadModal } from "@/components/group/csv-upload-modal";
import { EditGroupForm } from "@/components/group/edit-group-form";
import { DataTable } from "@/components/share/data-table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Download, Edit, ShieldCheck, Upload, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import { toast } from "sonner";

type Task = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  evaluator: string | null;
  evaluationLogic: string | null;
  contributionType: string;
  user: {
    name: string | null;
  };
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    members: {
      id: string;
      userId: string;
    }[];
  };
};

type GroupDetailProps = {
  tasks: Task[];
};

export function GroupDetail({ tasks }: GroupDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [nonRewardTasks, setNonRewardTasks] = useState<Task[]>(tasks);
  const [rewardTasks, setRewardTasks] = useState<Task[]>(tasks.filter((task) => task.contributionType === "REWARD"));
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // 権限付与関連の状態
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [isOperationAuthorized, setIsOperationAuthorized] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [canDeleteGroup, setCanDeleteGroup] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [canRemoveMember, setCanRemoveMember] = useState(false);
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] = useState<string | null>(null);
  const [selectedMemberNameForRemoval, setSelectedMemberNameForRemoval] = useState<string | null>(null);
  const [isRemovalComboboxOpen, setIsRemovalComboboxOpen] = useState(false);
  const [addToBlackList, setAddToBlackList] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // グループ参加処理
  async function handleJoin(groupId: string) {
    try {
      const result = await joinGroup(groupId);

      if (result.success) {
        toast.success("グループに参加しました");
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  // グループのタスク情報をCSV形式でエクスポートする関数
  async function onExport(groupId: string) {
    try {
      // タスク情報を取得(タスクごとにオブジェクトの要素を配列として取得)
      const tasks = await exportGroupTask(groupId);

      // Papaparse を利用して、JavaScript のオブジェクト配列を CSV 形式の文字列に変換する
      const csv = Papa.unparse(tasks);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tasks[0].group.name}_tasks.csv`;
      a.click();

      // 少し待ってから 一時的なURLを解放する（ダウンロード完了前に削除してしまうとバグになるため。）
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      toast.error("エラーが発生しました");
    }
  }

  // 権限付与ダイアログを開く処理
  async function handleOpenPermissionDialog() {
    try {
      const members = await getGroupMembers(tasks[0].group.id);
      // 現在のユーザーがグループオーナーかチェック
      const currentUserId = session?.user?.id;
      const currentUserMembership = members.find((member) => member.userId === currentUserId);
      setIsOperationAuthorized(currentUserMembership?.isGroupOwner || false);

      // グループメンバー一覧を設定
      setGroupMembers(members);
      setShowPermissionDialog(true);
    } catch (error) {
      console.error(error);
      toast.error("メンバー情報の取得に失敗しました");
    }
  }

  // 権限付与処理
  async function handleGrantPermission() {
    if (!selectedUserId) {
      toast.error("ユーザーを選択してください");
      return;
    }

    try {
      const result = await grantOwnerPermission(tasks[0].group.id, selectedUserId);

      if (result.success) {
        toast.success("グループオーナー権限を付与しました");
        setShowPermissionDialog(false);
        setSelectedUserId(null);
        setSelectedUserName(null);
        setIsComboboxOpen(false);
        setIsOperationAuthorized(false);
        setSelectedUserId(null);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  // グループ削除処理
  async function handleDeleteGroup() {
    try {
      const result = await deleteGroup(tasks[0].group.id);

      if (result.success) {
        toast.success("グループを削除しました");
        router.push("/dashboard/my-groups");
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  // グループ削除ダイアログを開く処理
  async function handleOpenDeleteDialog() {
    try {
      // 現在のユーザーがグループオーナーかチェック
      const currentUserId = session?.user?.id;
      if (!currentUserId) {
        toast.error("ユーザー情報が取得できませんでした");
        return;
      }
      const isGroupOwner = await checkGroupOwner(tasks[0].group.id, currentUserId);
      setCanDeleteGroup(isGroupOwner);
      setDeleteDialogOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("グループオーナー権限の取得に失敗しました");
    }
  }

  // メンバー除名ダイアログを開く処理
  async function handleOpenRemoveMemberDialog() {
    try {
      const members = await getGroupMembers(tasks[0].group.id);
      // 現在のユーザーがグループオーナーかチェック
      const currentUserId = session?.user?.id;
      const currentUserMembership = members.find((member) => member.userId === currentUserId);
      setCanRemoveMember(currentUserMembership?.isGroupOwner || false);

      // グループメンバー一覧を設定（オーナー以外のメンバーのみ）
      setGroupMembers(members.filter((member) => !member.isGroupOwner));
      setRemoveMemberDialogOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("メンバー情報の取得に失敗しました");
    }
  }

  // メンバー除名処理
  async function handleRemoveMember() {
    if (!selectedMemberForRemoval) {
      toast.error("メンバーを選択してください");
      return;
    }

    try {
      const result = await removeMember(tasks[0].group.id, selectedMemberForRemoval, addToBlackList);

      if (result.success) {
        toast.success("メンバーを除名しました");
        setRemoveMemberDialogOpen(false);
        setSelectedMemberForRemoval(null);
        setSelectedMemberNameForRemoval(null);
        setIsRemovalComboboxOpen(false);
        setAddToBlackList(false);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  // グループ情報編集ダイアログを開く処理
  async function handleOpenEditDialog() {
    try {
      // 現在のユーザーがグループオーナーかチェック
      const currentUserId = session?.user?.id;
      if (!currentUserId) {
        toast.error("ユーザー情報が取得できませんでした");
        return;
      }
      await checkGroupOwner(tasks[0].group.id, currentUserId);
      setEditDialogOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("グループオーナー権限の取得に失敗しました");
    }
  }

  const taskColumns: Column<Task>[] = [
    {
      key: "name" as keyof Task,
      header: "NAME",
      cell: (row: Task) => row.user.name || "-",
      sortable: true,
    },
    {
      key: "task" as keyof Task,
      header: "TASK",
      cell: (row: Task) => row.task,
      sortable: true,
    },
    {
      key: "contributionPoint" as keyof Task,
      header: "POINT",
      cell: (row: Task) => `${row.fixedContributionPoint || 0}p`,
      sortable: true,
    },
    {
      key: "contributionType" as keyof Task,
      header: "TYPE",
      cell: (row: Task) => row.contributionType,
      sortable: true,
    },
    {
      key: "evaluator" as keyof Task,
      header: "EVALUATOR",
      cell: (row: Task) => row.evaluator || "-",
      sortable: true,
    },
    {
      key: "evaluationLogic" as keyof Task,
      header: "EVALUATION LOGIC",
      cell: (row: Task) => row.evaluationLogic || "-",
      sortable: true,
    },
    {
      key: "status" as keyof Task,
      header: "STATUS",
      statusCombobox: true,
    },
  ];

  const taskDataTableProps: DataTableProps<Task> = {
    data: nonRewardTasks,
    columns: taskColumns,
    pagination: true,
    onDataChange: setNonRewardTasks,
  };

  const rewardColumns: Column<Task>[] = [
    {
      key: "task" as keyof Task,
      header: "アクション",
      cell: (row: Task) => (
        <Button onClick={() => router.push(`/dashboard/group/${row.group.id}/auction/${row.id}`)} className="button-default-custom" size="sm">
          オークションに参加
        </Button>
      ),
      className: "w-32",
    },
    {
      key: "user" as keyof Task,
      header: "NAME",
      sortable: true,
      cell: (row: Task) => row.user.name || "-",
    },
    {
      key: "task" as keyof Task,
      header: "TASK",
      sortable: true,
      cell: (row: Task) => row.task,
    },
    {
      key: "contributionPoint" as keyof Task,
      header: "現在の入札額 Point",
      sortable: true,
      cell: (row: Task) => `${row.fixedContributionPoint || 0}p`,
    },
    {
      key: "contributionType" as keyof Task,
      header: "TYPE",
      sortable: true,
      cell: (row: Task) => row.contributionType,
    },
    {
      key: "evaluator" as keyof Task,
      header: "EVALUATOR",
      sortable: true,
      cell: (row: Task) => row.evaluator || "-",
    },
    {
      key: "evaluationLogic" as keyof Task,
      header: "EVALUATION LOGIC",
      sortable: true,
      cell: (row: Task) => row.evaluationLogic || "-",
    },
    {
      key: "status" as keyof Task,
      header: "STATUS",
      statusCombobox: true,
      sortable: true,
      cell: (row: Task) => row.status,
    },
  ];

  const rewardDataTableProps: DataTableProps<Task> = {
    data: rewardTasks,
    columns: rewardColumns,
    pagination: true,
    onDataChange: setRewardTasks,
  };

  return (
    <div className="space-y-6">
      {/* グループ情報 */}
      <div>
        <h1 className="page-title-custom">{tasks[0].group.name}</h1>
        <p className="text-neutral-900">参加上限人数: {tasks[0].group.maxParticipants}人</p>
        <p className="text-neutral-900">Group目標: {tasks[0].group.goal}</p>
        <p className="text-neutral-900">評価方法: {tasks[0].group.evaluationMethod}</p>
      </div>

      {/* 参加ボタン（未参加の場合のみ表示） */}
      {tasks[0].group.members.length === 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="button-default-custom">
              <UserPlus className="mr-2 h-4 w-4" />
              参加する
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="alert-dialog-title-custom">グループに参加しますか？</AlertDialogTitle>
              <AlertDialogDescription className="alert-dialog-description-custom">
                グループに参加すると、グループのメンバーとして参加できます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button onClick={() => handleJoin(tasks[0].group.id)} className="button-default-custom">
                  参加する
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* アクションボタン */}
      <div className="flex flex-wrap gap-2">
        <Button className="button-default-custom" onClick={() => router.push(`/dashboard/new-task?groupId=${tasks[0].group.id}`)}>
          貢献入力
        </Button>
        <Button className="button-default-custom" onClick={() => onExport(tasks[0].group.id)}>
          <Download />
          Export
        </Button>
        <Button className="button-default-custom" onClick={() => setIsUploadModalOpen(true)}>
          <Upload />
          Upload
        </Button>
        <Button className="button-default-custom" onClick={handleOpenPermissionDialog}>
          <ShieldCheck />
          権限付与
        </Button>
        <Button variant="destructive" onClick={handleOpenDeleteDialog}>
          Group削除
        </Button>
        <Button variant="destructive" onClick={handleOpenRemoveMemberDialog}>
          メンバー除名
        </Button>
        <Button className="button-default-custom" onClick={handleOpenEditDialog}>
          <Edit />
          Group情報編集
        </Button>
      </div>

      {/* 権限付与用ComboBoxダイアログ */}
      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="alert-dialog-title-custom">グループオーナー権限付与</AlertDialogTitle>
            <AlertDialogDescription className="alert-dialog-description-custom">
              {isOperationAuthorized
                ? "グループオーナー権限を付与するユーザーを選択してください。"
                : "グループオーナー権限がないため、権限を付与することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isOperationAuthorized && (
            <div className="py-4">
              <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-full justify-between">
                    {selectedUserName || "ユーザーを選択"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="ユーザーを検索..." />
                    <CommandList>
                      <CommandEmpty>ユーザーが見つかりません</CommandEmpty>
                      <CommandGroup>
                        {groupMembers
                          .filter((member) => !member.isGroupOwner)
                          .map((member) => (
                            <CommandItem
                              key={member.user.id}
                              value={member.user.name}
                              onSelect={() => {
                                setSelectedUserId(member.user.id);
                                setSelectedUserName(member.user.name);
                                setIsComboboxOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedUserId === member.user.id ? "opacity-100" : "opacity-0"}`} />
                              {member.user.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {isOperationAuthorized && (
              <AlertDialogAction asChild>
                <Button onClick={handleGrantPermission} className="button-default-custom" disabled={!selectedUserId}>
                  権限を付与
                </Button>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* グループ削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="alert-dialog-title-custom">グループを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="alert-dialog-description-custom">
              {canDeleteGroup
                ? "グループを削除すると、そのグループに関連するデータも全て削除されます。\nこの操作は元に戻せません。"
                : "グループオーナー権限がないため、グループを削除することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {canDeleteGroup && (
              <AlertDialogAction asChild>
                <Button variant="destructive" onClick={handleDeleteGroup}>
                  削除する
                </Button>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* メンバー除名ダイアログ */}
      <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="alert-dialog-title-custom">メンバー除名</AlertDialogTitle>
            <AlertDialogDescription className="alert-dialog-description-custom">
              {canRemoveMember
                ? `除名するメンバーを選択してください。ブラックリストに追加すると、今後このメンバーは、${tasks[0].group.name}に参加できなくなります。`
                : "グループオーナー権限がないため、メンバーを除名することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {canRemoveMember && (
            <div className="space-y-4 py-4">
              <Popover open={isRemovalComboboxOpen} onOpenChange={setIsRemovalComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={isRemovalComboboxOpen} className="w-full justify-between">
                    {selectedMemberNameForRemoval || "メンバーを選択"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="メンバーを検索..." />
                    <CommandList>
                      <CommandEmpty>メンバーが見つかりません</CommandEmpty>
                      <CommandGroup>
                        {groupMembers.map((member) => (
                          <CommandItem
                            key={member.user.id}
                            value={member.user.name}
                            onSelect={() => {
                              setSelectedMemberForRemoval(member.user.id);
                              setSelectedMemberNameForRemoval(member.user.name);
                              setIsRemovalComboboxOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedMemberForRemoval === member.user.id ? "opacity-100" : "opacity-0"}`} />
                            {member.user.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex items-center space-x-2">
                <Checkbox id="blacklist" checked={addToBlackList} onCheckedChange={(checked) => setAddToBlackList(checked === true)} />
                <label htmlFor="blacklist" className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  ブラックリストに追加する（再入会禁止）
                </label>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {canRemoveMember && (
              <AlertDialogAction asChild>
                <Button variant="destructive" onClick={handleRemoveMember} disabled={!selectedMemberForRemoval}>
                  除名する
                </Button>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* グループ情報編集ダイアログ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>グループ情報編集</DialogTitle>
          </DialogHeader>
          {tasks[0] && tasks[0].group && (
            <EditGroupForm
              group={{
                id: tasks[0].group.id,
                name: tasks[0].group.name,
                goal: tasks[0].group.goal,
                evaluationMethod: tasks[0].group.evaluationMethod,
                maxParticipants: tasks[0].group.maxParticipants,
              }}
              onClose={() => setEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* タスク一覧 */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">Task一覧</h2>
        <DataTable dataTableProps={taskDataTableProps} />
      </div>

      {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
      <div>
        <h2 className="text-app mb-4 text-xl font-semibold">報酬一覧</h2>
        <DataTable dataTableProps={rewardDataTableProps} />
      </div>

      {/* CSVアップロードモーダル */}
      <CsvUploadModal isOpen={isUploadModalOpen} groupId={tasks[0].group.id} onCloseAction={() => setIsUploadModalOpen(false)} />
    </div>
  );
}
