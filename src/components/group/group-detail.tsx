"use client";

import type { GroupMemberWithUser } from "@/lib/actions/group";
import type { Column, DataTableProps, Task } from "@/types/group-types";
import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { EditGroupForm } from "@/components/form/edit-group-form";
import { CsvUploadModal } from "@/components/modal/csv-upload-modal";
import { ExportDataModal } from "@/components/modal/export-data-modal";
import { ShareTable } from "@/components/share/share-table";
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
import { useGroupDetail } from "@/hooks/group/use-group-detail";
import { useGroupMembers } from "@/hooks/group/use-group-members";
import { useGroupTasks } from "@/hooks/group/use-group-tasks";
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネントのprops
 * @param tasks {Task[]} タスクデータ
 */
type GroupDetailProps = {
  tasks: Task[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネント
 * @param tasks {Task[]} タスクデータ
 * @returns {JSX.Element} グループ詳細ページのコンポーネント
 */
export const GroupDetail = memo(function GroupDetail({ tasks }: GroupDetailProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // カスタムフックを使用
  const {
    isLoading,
    isMember,
    isAppOwner,
    isGroupOwner,
    userId,
    deleteDialogOpen,
    leaveDialogOpen,
    editDialogOpen,
    setDeleteDialogOpen,
    setLeaveDialogOpen,
    setEditDialogOpen,
    handleJoin,
    handleLeave,
    executeLeave,
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleDeleteGroup,
  } = useGroupDetail({ tasks });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const groupMembersResult = useGroupMembers({
    groupId: tasks.length > 0 ? tasks[0].group.id : "",
    isGroupOwner,
    isAppOwner,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useGroupMembersフックからの戻り値
  const {
    groupMembers,
    showPermissionDialog,
    setShowPermissionDialog,
    selectedUserId,
    setSelectedUserId,
    selectedUserName,
    setSelectedUserName,
    isComboboxOpen,
    setIsComboboxOpen,
    removeMemberDialogOpen,
    setRemoveMemberDialogOpen,
    selectedMemberForRemoval,
    setSelectedMemberForRemoval,
    selectedMemberNameForRemoval,
    setSelectedMemberNameForRemoval,
    isRemovalComboboxOpen,
    setIsRemovalComboboxOpen,
    addToBlackList,
    setAddToBlackList,
    handleOpenPermissionDialog,
    handleGrantPermission,
    handleOpenRemoveMemberDialog,
    handleRemoveMember,
  } = groupMembersResult;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const groupTasksResult = useGroupTasks({
    initialTasks: tasks,
    userId,
    isGroupOwner,
    isAppOwner,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // useGroupTasksフックからの戻り値
  const {
    nonRewardTasks,
    rewardTasks,
    users,
    isUploadModalOpen,
    setIsUploadModalOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    getReporterNames,
    getExecutorNames,
    handleDeleteTask,
    canDeleteTask,
    canEditTask,
    handleTaskEdited,
    updateNonRewardTasks,
    updateRewardTasks,
  } = groupTasksResult;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 共通のテーブル列定義（contributionType列を含まない）
  const commonColumns: Column<Task>[] = useMemo(
    () => [
      {
        key: "task" as keyof Task,
        header: "TASK",
        cell: (row: Task) => (row as unknown as Task).task ?? "不明",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "name" as keyof Task,
        header: "作成者",
        cell: (row: Task) => (row as unknown as Task).creator.name ?? "-",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "reporters" as keyof Task,
        header: "報告者",
        cell: (row: Task) => {
          const typedRow = row as unknown as Task;
          if (typeof getReporterNames === "function") {
            return getReporterNames(typedRow.reporters);
          }
          return "-";
        },
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "executors" as keyof Task,
        header: "実行者",
        cell: (row: Task) => {
          const typedRow = row as unknown as Task;
          if (typeof getExecutorNames === "function") {
            return getExecutorNames(typedRow.executors);
          }
          return "-";
        },
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "fixedEvaluator" as keyof Task,
        header: "評価者",
        cell: (row: Task) => (row as unknown as Task).fixedEvaluator ?? "-",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "fixedEvaluationLogic" as keyof Task,
        header: "評価ロジック",
        cell: (row: Task) => (row as unknown as Task).fixedEvaluationLogic ?? "-",
        sortable: true,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "status" as keyof Task,
        header: "ステータス",
        cell: () => null,
        statusCombobox: true,
        sortable: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "action" as keyof Task,
        header: "アクション",
        cell: () => null,
        sortable: false,
        statusCombobox: false,
        editTask: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "detail" as keyof Task,
        header: "詳細",
        cell: (row: Task) => (row as unknown as Task).detail ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [getReporterNames, getExecutorNames],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 非報酬タスク用のカラム
  const nonRewardColumns: Column<Task>[] = useMemo(
    () => [
      ...commonColumns.slice(0, 4), // task, name, reporters, executors 列をコピー
      {
        key: "contributionPoint" as keyof Task,
        header: "貢献ポイント",
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cell: (row: Task) => {
          const typedRow = row as unknown as Task;
          return typedRow.fixedContributionPoint ? `${typedRow.fixedContributionPoint}p` : "評価待ち";
        },
        sortable: true,
        statusCombobox: false,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      ...commonColumns.slice(4, 7), // fixedEvaluator, fixedEvaluationLogic, status 列をコピー
      {
        key: "action" as keyof Task,
        cell: () => null,
        header: "アクション",
        sortable: false,
        statusCombobox: false,
        editTask: true,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "delete" as keyof Task,
        cell: () => null,
        header: "削除",
        sortable: false,
        statusCombobox: false,
        editTask: false,
        deleteTask: {
          canDelete: (row: Task) => canDeleteTask(row),
          onDelete: handleDeleteTask,
        },
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        cellClassName: null,
      },
      {
        key: "detail" as keyof Task,
        header: "詳細",
        cell: (row: Task) => (row as unknown as Task).detail ?? "-",
        sortable: false,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [canDeleteTask, handleDeleteTask, commonColumns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 報酬タスク用のカラム
  const rewardColumns: Column<Task>[] = useMemo(
    () => [
      {
        key: "auction" as keyof Task,
        header: "オークション",
        cell: (row: Task) => {
          const typedRow = row as unknown as Task;
          return (
            <Button onClick={() => router.push(`/dashboard/auction/${typedRow.id}`)} className="button-default-custom" size="sm">
              オークションに参加
            </Button>
          );
        },
        sortable: false,
        className: "w-32",
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
      ...commonColumns.slice(0, 4), // task, name, reporters, executors 列をコピー
      {
        key: "contributionPoint" as keyof Task,
        header: "現在の入札額",
        cell: (row: Task) => `${(row as unknown as Task).fixedContributionPoint ?? 0}p`,
        sortable: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: "text-center",
      },
      ...commonColumns.slice(4, 7), // fixedEvaluator, fixedEvaluationLogic, status 列をコピー
      {
        key: "action" as keyof Task,
        header: "アクション",
        cell: () => null,
        sortable: false,
        editTask: true,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        deleteTask: null,
        cellClassName: null,
      },
      {
        key: "delete" as keyof Task,
        header: "削除",
        cell: () => null,
        deleteTask: {
          canDelete: (row: Task) => canDeleteTask(row),
          onDelete: handleDeleteTask,
        },
        sortable: false,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        cellClassName: null,
      },
      {
        key: "detail" as keyof Task,
        header: "詳細",
        cell: (row: Task) => (row as unknown as Task).detail ?? "-",
        sortable: false,
        className: null,
        statusCombobox: false,
        joinGroupModal: false,
        leaveGroupModal: false,
        modalList: null,
        editTask: false,
        deleteTask: null,
        cellClassName: null,
      },
    ],
    [canDeleteTask, router, handleDeleteTask, commonColumns],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // DataTableコンポーネントのpropsを設定
  const taskDataTableProps: DataTableProps<Task> = useMemo(
    () => ({
      initialData: nonRewardTasks as unknown as Task[],
      columns: nonRewardColumns as unknown as Column<Task>[],
      onDataChange: (data) => updateNonRewardTasks(data as unknown as Task[]),
      editTask: {
        canEdit: (row) => canEditTask(row as unknown as Task),
        onEdit: () => handleTaskEdited(),
        users: Array.isArray(users)
          ? users.map((user) => ({
              id: user.id,
              name: user.name ?? "",
            }))
          : [],
      },
      pagination: {
        totalRowCount: nonRewardTasks.length,
        currentPage: 1,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onPageChange: () => {},
        itemPerPage: 10,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onItemPerPageChange: () => {},
      },
      sort: {
        onSortChange: (field: keyof Task) => {
          console.log(field);
        },
        sortField: "id",
        sortDirection: "desc",
      },
      filter: null,
    }),
    [canEditTask, handleTaskEdited, updateNonRewardTasks, users, nonRewardColumns, nonRewardTasks],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const rewardTaskDataTableProps: DataTableProps<Task> = useMemo(
    () => ({
      initialData: rewardTasks as unknown as Task[],
      columns: rewardColumns as unknown as Column<Task>[],
      onDataChange: (data) => updateRewardTasks(data as unknown as Task[]),
      editTask: {
        canEdit: (row) => canEditTask(row as unknown as Task),
        onEdit: () => handleTaskEdited(),
        users: Array.isArray(users)
          ? users.map((user) => ({
              id: user.id,
              name: user.name ?? "",
            }))
          : [],
      },
      pagination: {
        totalRowCount: rewardTasks.length,
        currentPage: 1,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onPageChange: () => {},
        itemPerPage: 10,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onItemPerPageChange: () => {},
      },
      sort: {
        sortField: "id",
        sortDirection: "desc",
        onSortChange: (field: keyof Task) => {
          console.log(field);
        },
      },
      filter: null,
    }),
    [canEditTask, handleTaskEdited, updateRewardTasks, users, rewardColumns, rewardTasks],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
            <Download />
            エクスポート
          </Button>

          {(isGroupOwner || isAppOwner) && (
            <>
              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenEditDialog}>
                <Edit />
                グループを編集
              </Button>

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={() => setIsUploadModalOpen(true)}>
                <Upload />
                CSVアップロード
              </Button>

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenPermissionDialog}>
                <ShieldCheck />
                権限を付与
              </Button>

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenRemoveMemberDialog}>
                <UserMinus />
                メンバーを除名
              </Button>

              <Button variant="destructive" onClick={handleOpenDeleteDialog}>
                <Trash2 />
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
          {tasks[0]?.group && (
            <EditGroupForm
              group={{
                id: tasks[0].group.id,
                name: tasks[0].group.name,
                goal: tasks[0].group.goal,
                evaluationMethod: tasks[0].group.evaluationMethod,
                maxParticipants: tasks[0].group.maxParticipants,
                depositPeriod: tasks[0].group.depositPeriod ?? 0,
              }}
              onCloseAction={() => setEditDialogOpen(false)}
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
                    {selectedUserName ?? "ユーザーを選択"}
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
                          .filter((member: GroupMemberWithUser) => !member.isGroupOwner)
                          .map((member: GroupMemberWithUser) => (
                            <CommandItem
                              key={member.user.id}
                              value={member.user.name ?? ""}
                              onSelect={() => {
                                setSelectedUserId(member.user.id);
                                setSelectedUserName(member.user.name);
                                setIsComboboxOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedUserId === member.user.id ? "opacity-100" : "opacity-0"}`} />
                              {member.user.name ?? "No Name"}
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
                <Button variant="destructive" onClick={() => handleDeleteGroup(tasks[0].group.id)}>
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
                    {selectedMemberNameForRemoval ?? "メンバーを選択"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="メンバーを検索..." />
                    <CommandList>
                      <CommandEmpty>メンバーが見つかりません</CommandEmpty>
                      <CommandGroup>
                        {groupMembers.map((member: GroupMemberWithUser) => (
                          <CommandItem
                            key={member.user.id}
                            value={member.user.name ?? ""}
                            onSelect={() => {
                              setSelectedMemberForRemoval(member.user.id);
                              setSelectedMemberNameForRemoval(member.user.name);
                              setIsRemovalComboboxOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedMemberForRemoval === member.user.id ? "opacity-100" : "opacity-0"}`} />
                            {member.user.name ?? "No Name"}
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
          <ShareTable dataTableProps={taskDataTableProps} />
        </div>

        {/* 報酬一覧（REWARDタイプのタスクのみ表示） */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center">
            <Award className="mr-2 h-5 w-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">報酬一覧</h2>
          </div>
          <ShareTable dataTableProps={rewardTaskDataTableProps} />
        </div>
      </div>

      {/* データエクスポートモーダル */}
      <ExportDataModal isOpen={isExportModalOpen} onCloseAction={setIsExportModalOpen} groupId={tasks[0].group.id} groupName={tasks[0].group.name} />

      {/* CSVアップロードモーダル */}
      <CsvUploadModal isOpen={isUploadModalOpen} groupId={tasks[0].group.id} onCloseAction={() => setIsUploadModalOpen(false)} />
    </div>
  );
});
