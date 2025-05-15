"use client";

import type { GroupMemberWithUser } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { checkAppOwner, checkGroupOwner, getGroupMembers, grantOwnerPermission } from "@/lib/actions/group";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフック
 */
type UseGroupMembersProps = {
  groupId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフックの戻り値
 */
type UseGroupMembersReturn = {
  // state
  isAppOwner: boolean;
  isGroupOwner: boolean;
  groupMembers: GroupMemberWithUser[];
  showPermissionDialog: boolean;
  addToBlackList: boolean;
  selectedUserId: string | null;
  selectedUserName: string | null;
  isComboboxOpen: boolean;
  removeMemberDialogOpen: boolean;
  selectedMemberForRemoval: string | null;
  selectedMemberNameForRemoval: string | null;
  isRemovalComboboxOpen: boolean;

  // action
  setShowPermissionDialog: (showPermissionDialog: boolean) => void;
  setSelectedUserId: (selectedUserId: string | null) => void;
  setSelectedUserName: (selectedUserName: string | null) => void;
  setIsComboboxOpen: (isComboboxOpen: boolean) => void;
  setRemoveMemberDialogOpen: (removeMemberDialogOpen: boolean) => void;
  setSelectedMemberForRemoval: (selectedMemberForRemoval: string | null) => void;
  setSelectedMemberNameForRemoval: (selectedMemberNameForRemoval: string | null) => void;
  setIsRemovalComboboxOpen: (isRemovalComboboxOpen: boolean) => void;
  setAddToBlackList: (addToBlackList: boolean) => void;
  handleOpenPermissionDialog: () => Promise<void>;
  handleGrantPermission: () => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフック
 * @param groupId {string} グループID
 * @param isGroupOwner {boolean} グループオーナーかどうか
 * @param isAppOwner {boolean} アプリオーナーかどうか
 */
export function useGroupPermission({ groupId }: UseGroupMembersProps): UseGroupMembersReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ルーター
   */
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
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
  // アプリオーナー
  const [isAppOwner, setIsAppOwner] = useState(false);
  // グループオーナー
  const [isGroupOwner, setIsGroupOwner] = useState(false);

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
      try {
        if (!userId) {
          redirect("/auth/signin");
        }

        // アプリオーナー権限のチェック
        const isOwner = await checkAppOwner(userId);
        setIsAppOwner(isOwner);

        // グループオーナー権限のチェック
        const isGroupOwnerResult = await checkGroupOwner(userId, groupId);
        setIsGroupOwner(isGroupOwnerResult);
      } catch (error) {
        console.error("権限チェックエラー:", error);
        toast.error("権限情報の取得に失敗しました");
      }
    }

    void checkPermissions();
  }, [groupId, userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限付与ダイアログを開く処理
   */
  const handleOpenPermissionDialog = useCallback(async () => {
    if (!isGroupOwner && !isAppOwner) {
      toast.error("権限がありません");
      return;
    }

    try {
      const members = await getGroupMembers(groupId);
      // グループメンバー一覧を設定
      setGroupMembers(members);
      setShowPermissionDialog(true);
    } catch (error) {
      console.error(error);
      toast.error("メンバー情報の取得に失敗しました");
    }
  }, [groupId, isGroupOwner, isAppOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限付与処理
   */
  const handleGrantPermission = useCallback(async () => {
    try {
      if (!isGroupOwner && !isAppOwner) {
        toast.error("権限がありません");
        return;
      }

      if (!selectedUserId) {
        toast.error("メンバーを選択してください");
        return;
      }

      const result = await grantOwnerPermission(groupId, selectedUserId);
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
  }, [groupId, isGroupOwner, isAppOwner, selectedUserId, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーのフックの戻り値
   */
  return {
    // state
    isAppOwner,
    isGroupOwner,
    groupMembers,
    showPermissionDialog,
    selectedUserId,
    selectedUserName,
    isComboboxOpen,
    removeMemberDialogOpen,
    selectedMemberForRemoval,
    selectedMemberNameForRemoval,
    isRemovalComboboxOpen,
    addToBlackList,

    // action
    setShowPermissionDialog,
    setSelectedUserId,
    setSelectedUserName,
    setIsComboboxOpen,
    setRemoveMemberDialogOpen,
    setSelectedMemberForRemoval,
    setSelectedMemberNameForRemoval,
    setIsRemovalComboboxOpen,
    setAddToBlackList,
    handleOpenPermissionDialog,
    handleGrantPermission,
  };
}
