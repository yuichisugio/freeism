"use client";

import type { GroupMember, Task } from "@/types/group";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAppOwner, checkAuth, checkGroupOwner, deleteGroup, joinGroup, leaveGroup } from "@/lib/actions/group";
import { toast } from "sonner";

export function useGroupDetail(tasks: Task[]) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);

  // 権限情報を保持するstate
  const [isAppOwner, setIsAppOwner] = useState(false);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
          const memberIds = tasks[0].group.members.map((member: GroupMember) => member.userId);
          setIsMember(memberIds.includes(userId));
        }
      } catch (error) {
        console.error("権限チェックエラー:", error);
        toast.error("権限情報の取得に失敗しました");
      }
    }

    void checkPermissions();
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
  function handleOpenEditDialog() {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    setEditDialogOpen(true);
  }

  // グループ削除ダイアログを開く処理
  function handleOpenDeleteDialog() {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    setDeleteDialogOpen(true);
  }

  // グループ削除処理
  async function handleDeleteGroup(groupId: string) {
    try {
      // 保存された権限情報を使用
      if (!isGroupOwner && !isAppOwner) {
        toast.error("権限がありません");
        return;
      }

      const result = await deleteGroup(groupId);
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

  return {
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
  };
}
