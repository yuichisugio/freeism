"use client";

import type { GroupMemberWithUser } from "@/types/group-types";
import { memo, useMemo } from "react";
import { EditGroupForm } from "@/components/form/edit-group-form";
import { GroupDetailTable } from "@/components/group/group-detail-table";
import { CsvUploadModal } from "@/components/modal/csv-upload-modal";
import { ExportDataModal } from "@/components/modal/export-data-modal";
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
import { useGroupManipulation } from "@/hooks/group/use-group-manipulation";
import { useGroupPermission } from "@/hooks/group/use-group-permission";
import { useGroupTasks } from "@/hooks/group/use-group-tasks";
import {
  Check,
  ChevronsUpDown,
  ClipboardCheck,
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
 * @param groupId {string} グループID
 */
type GroupDetailProps = {
  groupId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのコンポーネント
 * @param tasks {Task[]} タスクデータ
 * @returns {JSX.Element} グループ詳細ページのコンポーネント
 */
export const GroupDetail = memo(function GroupDetail({ groupId }: GroupDetailProps): JSX.Element {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useGroupPermissionフックからの戻り値
   */
  const {
    // states
    isGroupOwner,
    isAppOwner,
    groupMembers, // 権限付与ダイアログ用
    showPermissionDialog,
    selectedUserId,
    selectedUserName,
    isComboboxOpen,

    // actions
    setShowPermissionDialog,
    setSelectedUserId,
    setSelectedUserName,
    setIsComboboxOpen,

    // functions
    handleOpenPermissionDialog,
    handleGrantPermission,
  } = useGroupPermission({
    groupId: groupId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useGroupTasksフックからの戻り値
   * テーブルのためのタスクのデータ取得
   */
  const {
    // states
    tasks,
    nonRewardTasks,
    rewardTasks,
    users,
    isUploadModalOpen,
    isExportModalOpen,
    // functions
    setIsUploadModalOpen,
    setIsExportModalOpen,
    getReporterNames,
    getExecutorNames,
    handleDeleteTask,
    canDeleteTask,
    canEditTask,
    handleTaskEdited,
    updateNonRewardTasks,
    updateRewardTasks,
  } = useGroupTasks({
    groupId: groupId,
    isGroupOwner, // isGroupOwner, isAppOwner を渡す
    isAppOwner,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useGroupDetailからの戻り値
   */
  const {
    // states
    isLoading,
    isMember,
    deleteDialogOpen,
    leaveDialogOpen,
    editDialogOpen,
    // メンバー除名関連 (useGroupManipulation から取得)
    groupMembers: manipGroupMembers,
    removeMemberDialogOpen: manipRemoveMemberDialogOpen,
    selectedMemberForRemoval: manipSelectedMemberForRemoval,
    selectedMemberNameForRemoval: manipSelectedMemberNameForRemoval,
    isRemovalComboboxOpen: manipIsRemovalComboboxOpen,
    addToBlackList: manipAddToBlackList,

    // actions
    setDeleteDialogOpen,
    setLeaveDialogOpen,
    setEditDialogOpen,
    setRemoveMemberDialogOpen: setManipRemoveMemberDialogOpen,
    setSelectedMemberForRemoval: setManipSelectedMemberForRemoval,
    setSelectedMemberNameForRemoval: setManipSelectedMemberNameForRemoval,
    setIsRemovalComboboxOpen: setManipIsRemovalComboboxOpen,
    setAddToBlackList: setManipAddToBlackList,

    // functions
    handleJoin,
    handleLeave,
    executeLeave,
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleDeleteGroup,
    handleOpenRemoveMemberDialog: handleOpenRemoveMemberDialogManip,
    handleRemoveMember: handleRemoveMemberManip,
  } = useGroupManipulation({
    tasks: tasks, // tasks を渡す
    isGroupOwner,
    isAppOwner,
    groupId: groupId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報
   */
  const currentGroup = useMemo(() => tasks[0].group, [tasks]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * tasksがロードされるまでローディング表示
   */
  if (!tasks || tasks.length === 0 || !tasks[0]?.group) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="ml-2">グループ情報を読み込んでいます...</p>
      </div>
    );
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報を表示
   */
  return (
    <div className="space-y-8">
      {/* グループ情報 */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{currentGroup.name}</h1>
        <div className="space-y-3">
          <div className="flex items-start">
            <TargetIcon className="mt-1 mr-2 h-5 w-5 text-gray-500" />
            <p className="text-gray-700">{currentGroup.goal}</p>
          </div>
          <div className="flex items-center">
            <Users className="mr-2 h-5 w-5 text-gray-500" />
            <span className="text-gray-700">
              参加人数: {currentGroup.members.length} / {currentGroup.maxParticipants}
            </span>
          </div>
          <div className="flex items-center">
            <ClipboardCheck className="mr-2 h-5 w-5 text-gray-500" />
            <span className="text-gray-700">評価方法: {currentGroup.evaluationMethod}</span>
          </div>
        </div>
      </div>

      {/* 参加していないユーザー向けの参加ボタン */}
      {!isMember && (
        <div className="flex justify-center">
          <Button onClick={() => handleJoin(currentGroup.id)} disabled={isLoading} className="bg-green-600 text-white hover:bg-green-700">
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

              <Button variant="outline" className="bg-white hover:bg-gray-50" onClick={handleOpenRemoveMemberDialogManip}>
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
          {currentGroup && (
            <EditGroupForm
              group={{
                id: currentGroup.id,
                name: currentGroup.name,
                goal: currentGroup.goal,
                evaluationMethod: currentGroup.evaluationMethod,
                maxParticipants: currentGroup.maxParticipants,
                depositPeriod: currentGroup.depositPeriod ?? 0,
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
                <Button variant="destructive" onClick={() => handleDeleteGroup(currentGroup.id)}>
                  削除する
                </Button>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* メンバー除名ダイアログ */}
      <AlertDialog open={manipRemoveMemberDialogOpen} onOpenChange={setManipRemoveMemberDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">メンバー除名</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              {isGroupOwner || isAppOwner
                ? `除名するメンバーを選択してください。ブラックリストに追加すると、今後このメンバーは、${currentGroup.name}に参加できなくなります。`
                : "グループオーナー権限がないため、メンバーを除名することができません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(isGroupOwner || isAppOwner) && (
            <div className="space-y-4 py-4">
              <Popover open={manipIsRemovalComboboxOpen} onOpenChange={setManipIsRemovalComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={manipIsRemovalComboboxOpen} className="w-full justify-between">
                    {manipSelectedMemberNameForRemoval ?? "メンバーを選択"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="メンバーを検索..." />
                    <CommandList>
                      <CommandEmpty>メンバーが見つかりません</CommandEmpty>
                      <CommandGroup>
                        {manipGroupMembers.map((member: GroupMemberWithUser) => (
                          <CommandItem
                            key={member.user.id}
                            value={member.user.name ?? ""}
                            onSelect={() => {
                              setManipSelectedMemberForRemoval(member.user.id);
                              setManipSelectedMemberNameForRemoval(member.user.name);
                              setManipIsRemovalComboboxOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${manipSelectedMemberForRemoval === member.user.id ? "opacity-100" : "opacity-0"}`} />
                            {member.user.name ?? "No Name"}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="space-x-2">
                <Checkbox id="blacklist" checked={manipAddToBlackList} onCheckedChange={(checked) => setManipAddToBlackList(checked === true)} />
                <Label htmlFor="blacklist">ブラックリストに追加する</Label>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {(isGroupOwner || isAppOwner) && (
              <AlertDialogAction asChild>
                <Button variant="destructive" onClick={handleRemoveMemberManip} disabled={!manipSelectedMemberForRemoval}>
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
                onClick={() => executeLeave(currentGroup.id)}
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
        <GroupDetailTable
          nonRewardTasks={nonRewardTasks}
          rewardTasks={rewardTasks}
          users={users}
          getReporterNames={getReporterNames}
          getExecutorNames={getExecutorNames}
          canDeleteTask={canDeleteTask}
          handleDeleteTask={handleDeleteTask}
          canEditTask={canEditTask}
          handleTaskEdited={handleTaskEdited}
          updateNonRewardTasks={updateNonRewardTasks}
          updateRewardTasks={updateRewardTasks}
        />
      </div>

      {/* データエクスポートモーダル */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onCloseAction={() => setIsExportModalOpen(false)}
        groupId={currentGroup.id}
        groupName={currentGroup.name}
      />

      {/* CSVアップロードモーダル */}
      <CsvUploadModal isOpen={isUploadModalOpen} groupId={currentGroup.id} onCloseAction={() => setIsUploadModalOpen(false)} />
    </div>
  );
});
