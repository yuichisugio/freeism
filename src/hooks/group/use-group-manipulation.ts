"use client";

import type { GroupMemberWithUser, Task } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { deleteGroup, getGroupMembers, joinGroup, removeMember } from "@/lib/actions/group";
import { leaveGroup } from "@/lib/actions/group/my-group";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのフックの戻り値の型
 */
type UseGroupDetailReturn = {
  // state
  isLoading: boolean;
  isMember: boolean;
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
  handleOpenRemoveMemberDialog: () => Promise<void>;
  handleRemoveMember: () => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのフック
 * @param tasks {Task[]} タスクデータ
 * @param isGroupOwner {boolean} グループオーナーかどうか
 * @param isAppOwner {boolean} アプリオーナーかどうか
 * @param groupId {string} グループID
 * @returns {UseGroupDetailReturn} グループ詳細ページのフックの戻り値
 */
export function useGroupManipulation({
  tasks,
  isGroupOwner,
  isAppOwner,
  groupId,
}: {
  tasks: Task[];
  isGroupOwner: boolean;
  isAppOwner: boolean;
  groupId: string;
}): UseGroupDetailReturn {
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
  // 削除ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 脱退ダイアログ
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // 編集ダイアログ
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // グループメンバー一覧
  const [groupMembers, setGroupMembers] = useState<GroupMemberWithUser[]>([]);
  // 権限付与ダイアログ
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  // 権限付与ダイアログで選択されたユーザーID
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  // 権限付与ダイアログで選択されたユーザー名
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  // 権限付与ダイアログのコンボボックスが開いているかどうか
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  // メンバー除名ダイアログ
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  // メンバー除名ダイアログで選択されたユーザーID
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] = useState<string | null>(null);
  // メンバー除名ダイアログで選択されたユーザー名
  const [selectedMemberNameForRemoval, setSelectedMemberNameForRemoval] = useState<string | null>(null);
  // メンバー除名ダイアログのコンボボックスが開いているかどうか
  const [isRemovalComboboxOpen, setIsRemovalComboboxOpen] = useState(false);
  // メンバー除名ダイアログで選択されたユーザーをブラックリストに追加するかどうか
  const [addToBlackList, setAddToBlackList] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションのuserIdを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンポーネントマウント時に権限チェックを一度だけ実行
   */
  useEffect(() => {
    async function checkPermissions() {
      if (!userId) {
        redirect("/auth/signin");
      }

      // ユーザーがグループのメンバーかどうかチェック
      const memberIds = tasks[0].group.members.map((member: { userId: string }) => member.userId);
      setIsMember(memberIds.includes(userId));
    }

    void checkPermissions();
  }, [tasks, userId]);

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メンバー除名ダイアログを開く処理
   */
  const handleOpenRemoveMemberDialog = useCallback(async () => {
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    try {
      const members = await getGroupMembers(groupId);
      // グループメンバー一覧を設定（オーナー以外のメンバーのみ）
      setGroupMembers(members.filter((member) => !member.isGroupOwner));
      setRemoveMemberDialogOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("メンバー情報の取得に失敗しました");
    }
  }, [groupId, isGroupOwner, isAppOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メンバー除名処理
   */
  const handleRemoveMember = useCallback(async () => {
    try {
      if (!isGroupOwner && !isAppOwner) {
        toast.error("権限がありません");
        return;
      }

      if (!selectedMemberForRemoval) {
        toast.error("メンバーを選択してください");
        return;
      }

      const result = await removeMember(groupId, selectedMemberForRemoval, addToBlackList);
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
  }, [groupId, isGroupOwner, isAppOwner, selectedMemberForRemoval, addToBlackList, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    isLoading,
    isMember,
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
    handleOpenRemoveMemberDialog,
    handleRemoveMember,
  };
}
