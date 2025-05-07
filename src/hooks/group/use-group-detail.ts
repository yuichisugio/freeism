"use client";

import type { Task } from "@/types/group";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAppOwner, checkGroupOwner, deleteGroup, joinGroup, leaveGroup } from "@/lib/actions/group";
import { fetchAuthenticatedUserId } from "@/lib/utils";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのフックの戻り値の型
 */
type UseGroupDetailReturn = {
  // state
  isLoading: boolean;
  isMember: boolean;
  isAppOwner: boolean;
  isGroupOwner: boolean;
  userId: string | null;
  deleteDialogOpen: boolean;
  leaveDialogOpen: boolean;
  editDialogOpen: boolean;

  // action
  setDeleteDialogOpen: (open: boolean) => void;
  setLeaveDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  handleJoin: (groupId: string) => Promise<void>;
  handleLeave: () => Promise<void>;
  executeLeave: (groupId: string) => Promise<void>;
  handleOpenEditDialog: () => void;
  handleOpenDeleteDialog: () => void;
  handleDeleteGroup: (groupId: string) => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのフック
 * @param tasks {Task[]} タスクデータ
 * @returns {UseGroupDetailReturn} グループ詳細ページのフックの戻り値
 */
export function useGroupDetail({ tasks }: { tasks: Task[] }): UseGroupDetailReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ステート
   */
  // ローディング
  const [isLoading, setIsLoading] = useState(false);
  // メンバー
  const [isMember, setIsMember] = useState(false);
  // アプリオーナー
  const [isAppOwner, setIsAppOwner] = useState(false);
  // グループオーナー
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  // ユーザーID
  const [userId, setUserId] = useState<string | null>(null);
  // 削除ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 脱退ダイアログ
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // 編集ダイアログ
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンポーネントマウント時に権限チェックを一度だけ実行
   */
  useEffect(() => {
    async function checkPermissions() {
      try {
        if (tasks.length === 0) return;

        const groupId = tasks[0].group.id;
        const userId = await fetchAuthenticatedUserId();

        if (userId) {
          setUserId(userId);

          // アプリオーナー権限のチェック
          const isOwner = await checkAppOwner(userId);
          setIsAppOwner(isOwner);

          // グループオーナー権限のチェック
          const isGroupOwnerResult = await checkGroupOwner(userId, groupId);
          setIsGroupOwner(isGroupOwnerResult);

          // ユーザーがグループのメンバーかどうかチェック
          const memberIds = tasks[0].group.members.map((member: { userId: string }) => member.userId);
          setIsMember(memberIds.includes(userId));
        }
      } catch (error) {
        console.error("権限チェックエラー:", error);
        toast.error("権限情報の取得に失敗しました");
      }
    }

    void checkPermissions();
  }, [tasks]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加処理
   * @param groupId {string} グループID
   */
  const handleJoin = useCallback(
    async (groupId: string) => {
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
    },
    [router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ脱退処理
   */
  const handleLeave = useCallback(async () => {
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
  }, [isGroupOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実際のグループ脱退処理を実行
   * @param groupId {string} グループID
   */
  const executeLeave = useCallback(
    async (groupId: string) => {
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
    },
    [router],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報編集ダイアログを開く処理
   */
  const handleOpenEditDialog = useCallback(() => {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    setEditDialogOpen(true);
  }, [isGroupOwner, isAppOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ削除ダイアログを開く処理
   */
  const handleOpenDeleteDialog = useCallback(() => {
    // 保存された権限情報を使用
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    setDeleteDialogOpen(true);
  }, [isGroupOwner, isAppOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ削除処理
   * @param groupId {string} グループID
   */
  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
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
    },
    [router, isGroupOwner, isAppOwner],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    isLoading,
    isMember,
    isAppOwner,
    isGroupOwner,
    userId,
    deleteDialogOpen,
    leaveDialogOpen,
    editDialogOpen,

    // action
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
