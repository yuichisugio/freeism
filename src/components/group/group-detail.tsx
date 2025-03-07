"use client";

import type { GroupMemberWithUser } from "@/app/actions/group";
import type { Column, DataTableProps } from "@/components/share/data-table";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkAppOwner,
  checkAuth,
  checkGroupOwner,
  deleteGroup,
  getGroupMembers,
  grantOwnerPermission,
  joinGroup,
  leaveGroup,
  removeMember,
} from "@/app/actions/group";
import { CsvUploadModal } from "@/components/group/csv-upload-modal";
import { EditGroupForm } from "@/components/group/edit-group-form";
import { ExportDataModal } from "@/components/group/export-data-modal";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Award,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardList,
  Download,
  Edit,
  Loader2,
  LogOut,
  ShieldCheck,
  TargetIcon,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type Task = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
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
  const [nonRewardTasks, setNonRewardTasks] = useState<Task[]>(tasks.filter((task) => task.contributionType === "NON_REWARD"));
  const [rewardTasks, setRewardTasks] = useState<Task[]>(tasks.filter((task) => task.contributionType === "REWARD"));
  const [groupMembers, setGroupMembers] = useState<GroupMemberWithUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] = useState<string | null>(null);
  const [selectedMemberNameForRemoval, setSelectedMemberNameForRemoval] = useState<string | null>(null);
  const [isRemovalComboboxOpen, setIsRemovalComboboxOpen] = useState(false);
  const [addToBlackList, setAddToBlackList] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);

  // 権限情報を保持するstate
  const [isAppOwner, setIsAppOwner] = useState(false);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // コンポーネントマウント時に権限チェックを一度だけ実行
  useEffect(() => {
    async function checkPermissions() {
      try {
        if (tasks.length === 0) return;

        const groupId = tasks[0].group.id;
        const userId = await checkAuth();

        if (userId) {
          setUserId(userId);

          // アプリオーナー権限のチェック
          const isOwner = await checkAppOwner(userId);
          setIsAppOwner(isOwner);

          // グループオーナー権限のチェック
          const isGroupOwnerResult = await checkGroupOwner(userId, groupId);
          setIsGroupOwner(isGroupOwnerResult);

          // ユーザーがグループのメンバーかどうかチェック
          const memberIds = tasks[0].group.members.map((member) => member.userId);
          setIsMember(memberIds.includes(userId));
        }
      } catch (error) {
        console.error("権限チェックエラー:", error);
        toast.error("権限情報の取得に失敗しました");
      }
    }

    checkPermissions();
  }, [tasks]);

  // グループ参加処理
  async function handleJoin(groupId: string) {
    try {
      setIsLoading(true);
      const result = await joinGroup(groupId);

      if (result.success) {
        toast.success("グループに参加しました");
        setIsMember(true);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  // グループ脱退処理
  async function handleLeave() {
    try {
      if (isGroupOwner) {
        toast.error("グループオーナーは脱退できません。オーナー権限を他のメンバーに譲渡するか、グループを削除してください。");
        return;
      }

      setLeaveDialogOpen(true);
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }

  // 実際のグループ脱退処理を実行
  async function executeLeave(groupId: string) {
    try {
      setIsLoading(true);
      const result = await leaveGroup(groupId);

      if (result.success) {
        toast.success("グループから脱退しました");
        setIsMember(false);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    } finally {
      setIsLoading(false);
      setLeaveDialogOpen(false);
    }
  }

  // グループ情報編集ダイアログを開く処理
  async function handleOpenEditDialog() {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    setEditDialogOpen(true);
  }

  // 権限付与ダイアログを開く処理
  async function handleOpenPermissionDialog() {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    try {
      const members = await getGroupMembers(tasks[0].group.id);
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
    try {
      // 保存された権限情報を使用
      if (!isGroupOwner && !isAppOwner) {
        toast.error("権限がありません");
        return;
      }

      if (!selectedUserId) {
        toast.error("メンバーを選択してください");
        return;
      }

      const result = await grantOwnerPermission(tasks[0].group.id, selectedUserId);
      if (result.success) {
        toast.success("権限を付与しました");
        setShowPermissionDialog(false);
        setSelectedUserId(null);
        setSelectedUserName(null);
        setIsComboboxOpen(false);
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
      // 保存された権限情報を使用
      if (!isGroupOwner && !isAppOwner) {
        toast.error("権限がありません");
        return;
      }

      const result = await deleteGroup(tasks[0].group.id);
      if (result.success) {
        toast.success("グループを削除しました");
        router.push("/groups");
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
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    setDeleteDialogOpen(true);
  }

  // メンバー除名ダイアログを開く処理
  async function handleOpenRemoveMemberDialog() {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    try {
      const members = await getGroupMembers(tasks[0].group.id);
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
    try {
      // 保存された権限情報を使用
      if (!isGroupOwner && !isAppOwner) {
        toast.error("権限がありません");
        return;
      }

      if (!selectedMemberForRemoval) {
        toast.error("メンバーを選択してください");
        return;
      }

      const result = await removeMember(tasks[0].group.id, selectedMemberForRemoval, addToBlackList);
      if (result.success) {
        toast.success("メンバーを削除しました");
        setRemoveMemberDialogOpen(false);
        setSelectedMemberForRemoval(null);
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
      key: "fixedEvaluator" as keyof Task,
      header: "EVALUATOR",
      cell: (row: Task) => row.fixedEvaluator || "-",
      sortable: true,
    },
    {
      key: "fixedEvaluationLogic" as keyof Task,
      header: "EVALUATION LOGIC",
      cell: (row: Task) => row.fixedEvaluationLogic || "-",
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
      key: "fixedEvaluator" as keyof Task,
      header: "EVALUATOR",
      sortable: true,
      cell: (row: Task) => row.fixedEvaluator || "-",
    },
    {
      key: "fixedEvaluationLogic" as keyof Task,
      header: "EVALUATION LOGIC",
      sortable: true,
      cell: (row: Task) => row.fixedEvaluationLogic || "-",
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
    <div className="space-y-8">
      {/* グループ情報 */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{tasks[0].group.name}</h1>
        <div className="space-y-3">
          <div className="flex items-start">
            <TargetIcon className="mt-1 mr-2 h-5 w-5 text-gray-500" />
            <p className="text-gray-700">{tasks[0].group.goal}</p>
          </div>
          <div className="flex items-center">
            <Users className="mr-2 h-5 w-5 text-gray-500" />
            <span className="text-gray-700">
              参加人数: {tasks[0].group.members.length} / {tasks[0].group.maxParticipants}
            </span>
          </div>
          <div className="flex items-center">
            <ClipboardCheck className="mr-2 h-5 w-5 text-gray-500" />
            <span className="text-gray-700">評価方法: {tasks[0].group.evaluationMethod}</span>
          </div>
        </div>
      </div>

      {/* 参加していないユーザー向けの参加ボタン */}
      {userId && !isMember && (
        <div className="flex justify-center">
          <Button onClick={() => handleJoin(tasks[0].group.id)} disabled={isLoading} className="bg-green-600 text-white hover:bg-green-700">
            <UserPlus className="mr-2 h-4 w-4" />
            グループに参加する
          </Button>
        </div>
      )}

      {/* 管理操作ボタン（権限のあるユーザーにのみ表示） */}
      {isMember && (
        <div className="mb-4 flex flex-wrap gap-3">
          <Button onClick={() => setIsExportModalOpen(true)} variant="outline" className="bg-white hover:bg-gray-50">
            <Download className="mr-2 h-4 w-4" />
            データをエクスポート
          </Button>

          {(isGroupOwner || isAppOwner) && (
            <>
              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenEditDialog}>
                <Edit className="mr-2 h-4 w-4" />
                グループを編集
              </Button>

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={() => setIsUploadModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                CSVアップロード
              </Button>

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenPermissionDialog}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                権限を付与
              </Button>

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenRemoveMemberDialog}>
                <UserMinus className="mr-2 h-4 w-4" />
                メンバーを除名
              </Button>

              <Button variant="destructive" onClick={handleOpenDeleteDialog}>
                <Trash2 className="mr-2 h-4 w-4" />
                グループを削除
              </Button>
            </>
          )}

          {/* 脱退ボタン（グループオーナー以外のメンバー向け） */}
          {isMember && !isGroupOwner && (
            <Button
              variant="outline"
              className="ml-auto border-red-200 bg-white text-red-600 hover:bg-gray-50 hover:text-red-700"
              onClick={() => handleLeave()}
              disabled={isLoading}
            >
              <LogOut className="mr-2 h-4 w-4" />
              グループを脱退
            </Button>
          )}
        </div>
      )}

      {/* グループ情報編集ダイアログ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">グループ情報編集</DialogTitle>
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

      {/* 権限付与用ダイアログ */}
      <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">グループオーナー権限付与</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {isGroupOwner || isAppOwner
                ? "グループオーナー権限を付与するユーザーを選択してください。"
                : "グループオーナー権限がないため、権限を付与することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(isGroupOwner || isAppOwner) && (
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
                              value={member.user.name || ""}
                              onSelect={() => {
                                setSelectedUserId(member.user.id);
                                setSelectedUserName(member.user.name);
                                setIsComboboxOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedUserId === member.user.id ? "opacity-100" : "opacity-0"}`} />
                              {member.user.name || "No Name"}
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
            <AlertDialogAction asChild>
              <Button onClick={handleGrantPermission} disabled={!(isGroupOwner || isAppOwner) || !selectedUserId} className="button-default-custom">
                権限を付与
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* グループ削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">グループを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {isGroupOwner || isAppOwner
                ? "グループを削除すると、そのグループに関連するデータも全て削除されます。\nこの操作は元に戻せません。"
                : "グループオーナー権限がないため、グループを削除することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {(isGroupOwner || isAppOwner) && (
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
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">メンバー除名</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {isGroupOwner || isAppOwner
                ? `除名するメンバーを選択してください。ブラックリストに追加すると、今後このメンバーは、${tasks[0].group.name}に参加できなくなります。`
                : "グループオーナー権限がないため、メンバーを除名することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(isGroupOwner || isAppOwner) && (
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
                            value={member.user.name || ""}
                            onSelect={() => {
                              setSelectedMemberForRemoval(member.user.id);
                              setSelectedMemberNameForRemoval(member.user.name);
                              setIsRemovalComboboxOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedMemberForRemoval === member.user.id ? "opacity-100" : "opacity-0"}`} />
                            {member.user.name || "No Name"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="space-x-2">
                <Checkbox id="blacklist" checked={addToBlackList} onCheckedChange={(checked) => setAddToBlackList(checked === true)} />
                <Label htmlFor="blacklist">ブラックリストに追加する</Label>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {(isGroupOwner || isAppOwner) && (
              <AlertDialogAction asChild>
                <Button variant="destructive" onClick={handleRemoveMember} disabled={!selectedMemberForRemoval}>
                  除名する
                </Button>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* グループ脱退確認ダイアログ */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">グループから脱退しますか？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              グループから脱退すると、グループのタスクにアクセスできなくなります。 この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={() => executeLeave(tasks[0].group.id)}
                disabled={isLoading}
                className="bg-red-500 hover:bg-red-600"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                脱退する
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* タスク・報酬セクション */}
      <div>
        {/* タスク一覧 */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center">
            <ClipboardList className="mr-2 h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">タスク一覧</h2>
          </div>
          <DataTable dataTableProps={taskDataTableProps} />
        </div>

        {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center">
            <Award className="mr-2 h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">報酬一覧</h2>
          </div>
          <DataTable dataTableProps={rewardDataTableProps} />
        </div>
      </div>

      {/* データエクスポートモーダル */}
      <ExportDataModal isOpen={isExportModalOpen} onCloseAction={setIsExportModalOpen} groupId={tasks[0].group.id} groupName={tasks[0].group.name} />

      {/* CSVアップロードモーダル */}
      <CsvUploadModal isOpen={isUploadModalOpen} groupId={tasks[0].group.id} onCloseAction={() => setIsUploadModalOpen(false)} />
    </div>
  );
}
