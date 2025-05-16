"use client";

import type { GroupMemberWithUser } from "@/types/group-types";
import { memo, useEffect, useState } from "react";
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
import { useGroupDetailModal } from "@/hooks/group/group-detail/use-group-detail-modal";
import { useGroupManipulation } from "@/hooks/group/group-detail/use-group-manipulation";
import { useGroupPermission } from "@/hooks/group/group-detail/use-group-permission";
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
   * Hydration mismatch 対策: クライアントマウント状態
   */
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

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
    isUploadModalOpen,
    isExportModalOpen,
    // functions
    setIsUploadModalOpen,
    setIsExportModalOpen,
  } = useGroupDetailModal();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * useGroupDetailからの戻り値 (useGroupManipulation)
   */
  const {
    // states
    group,
    isMember,
    deleteDialogOpen,
    leaveDialogOpen,
    editDialogOpen,
    groupMembers: manipGroupMembers, // 別名
    removeMemberDialogOpen,
    selectedMemberForRemoval,
    selectedMemberNameForRemoval,
    isRemovalComboboxOpen,
    addToBlackList,
    isLoadingGroup,

    // mutation states (具体的なローディング状態を使用)
    isJoiningGroup,
    isLeavingGroup,
    isDeletingGroup,
    isFetchingMembersForRemoval,
    isRemovingMember,

    // actions
    setDeleteDialogOpen,
    setLeaveDialogOpen,
    setEditDialogOpen,
    setRemoveMemberDialogOpen,
    setSelectedMemberForRemoval,
    setSelectedMemberNameForRemoval,
    setIsRemovalComboboxOpen,
    setAddToBlackList,

    // functions (フックの戻り値に合わせる)
    handleJoinGroup, // handleJoin -> handleJoinGroup
    handleLeave, // 変更なし
    executeLeaveGroup, // executeLeave -> executeLeaveGroup
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleDeleteGroup,
    handleOpenRemoveMemberDialog, // manip を削除
    handleRemoveMember, // manip を削除
  } = useGroupManipulation({
    isGroupOwner,
    isAppOwner,
    groupId: groupId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ローディング中は、ローディング中の表示を返す
   */
  if (!hasMounted || isLoadingGroup) {
    // マウント前、またはマウント後でもローディング中の場合
    // groupが存在しない場合もローディングとみなす（初期ロード時）
    if (!hasMounted || !group || isLoadingGroup) {
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="ml-2">グループ情報を読み込んでいます...</p>
        </div>
      );
    }
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループが見つからない場合の処理
   */
  if (!group) {
    return <div>グループが見つかりません</div>;
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報を表示
   */
  return (
    <>
      <div className="space-y-8">
        {/* グループ情報 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">{group.name}</h1>
          <div className="space-y-3">
            <div className="flex items-start">
              <TargetIcon className="mt-1 mr-2 h-5 w-5 text-gray-500" />
              <p className="text-gray-700">{group.goal}</p>
            </div>
            <div className="flex items-center">
              <Users className="mr-2 h-5 w-5 text-gray-500" />
              <span className="text-gray-700">
                参加人数: {group.joinMemberCount} / {group.maxParticipants}
              </span>
            </div>
            <div className="flex items-center">
              <ClipboardCheck className="mr-2 h-5 w-5 text-gray-500" />
              <span className="text-gray-700">評価方法: {group.evaluationMethod}</span>
            </div>
          </div>
        </div>

        {/* 参加していないユーザー向けの参加ボタン */}
        {!isMember && (
          <div className="flex justify-center">
            <Button onClick={() => handleJoinGroup(group.id)} disabled={isJoiningGroup} className="bg-green-600 text-white hover:bg-green-700">
              {isJoiningGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
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

                <Button
                  variant="outline"
                  className="bg-white hover:bg-gray-50"
                  onClick={handleOpenRemoveMemberDialog}
                  disabled={isFetchingMembersForRemoval}
                >
                  {isFetchingMembersForRemoval ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus />}
                  メンバーを除名
                </Button>

                <Button variant="destructive" onClick={handleOpenDeleteDialog} disabled={isDeletingGroup}>
                  {isDeletingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 />}
                  グループを削除
                </Button>
              </>
            )}

            {/* 脱退ボタン（グループオーナー以外のメンバー向け） */}
            {isMember && !isGroupOwner && (
              <Button
                variant="outline"
                className="ml-auto border-red-200 bg-white text-red-600 hover:bg-gray-50 hover:text-red-700"
                onClick={() => handleLeave()} // handleLeave はダイアログを開くだけなので isLeavingGroup は不要
                disabled={isLeavingGroup} // executeLeaveGroup の状態を見る
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
            {group && (
              <EditGroupForm
                group={{
                  id: group.id,
                  name: group.name,
                  goal: group.goal,
                  evaluationMethod: group.evaluationMethod,
                  maxParticipants: group.maxParticipants,
                  depositPeriod: group.depositPeriod ?? 0,
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
                  <Button variant="destructive" onClick={() => handleDeleteGroup(group.id)} disabled={isDeletingGroup}>
                    {isDeletingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "削除する"}
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
                  ? `除名するメンバーを選択してください。ブラックリストに追加すると、今後このメンバーは、${group.name}に参加できなくなります。`
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
                          {manipGroupMembers.map((member: GroupMemberWithUser) => (
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
                  <Button variant="destructive" onClick={handleRemoveMember} disabled={!selectedMemberForRemoval || isRemovingMember}>
                    {isRemovingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "除名する"}
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
                  onClick={() => executeLeaveGroup(group.id)}
                  disabled={isLeavingGroup} // isLeavingGroup を使用
                  className="bg-red-500 hover:bg-red-600"
                >
                  {isLeavingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                  脱退する
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* タスク・報酬セクション */}
        <div>
          <GroupDetailTable groupId={group.id} isGroupOwner={isGroupOwner} isAppOwner={isAppOwner} />
        </div>

        {/* データエクスポートモーダル */}
        <ExportDataModal isOpen={isExportModalOpen} onCloseAction={() => setIsExportModalOpen(false)} groupId={group.id} groupName={group.name} />

        {/* CSVアップロードモーダル */}
        <CsvUploadModal isOpen={isUploadModalOpen} groupId={group.id} onCloseAction={() => setIsUploadModalOpen(false)} />
      </div>
    </>
  );
});
