"use client";

import type { GroupMemberWithUser } from "@/lib/actions/group";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getGroupMembers, grantOwnerPermission, removeMember } from "@/lib/actions/group";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフック
 */
type UseGroupMembersProps = {
  groupId: string;
  isGroupOwner: boolean;
  isAppOwner: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type UseGroupMembersReturn = {
  groupMembers: GroupMemberWithUser[];
  showPermissionDialog: boolean;
  setShowPermissionDialog: (showPermissionDialog: boolean) => void;
  selectedUserId: string | null;
  setSelectedUserId: (selectedUserId: string | null) => void;
  selectedUserName: string | null;
  setSelectedUserName: (selectedUserName: string | null) => void;
  isComboboxOpen: boolean;
  setIsComboboxOpen: (isComboboxOpen: boolean) => void;
  removeMemberDialogOpen: boolean;
  setRemoveMemberDialogOpen: (removeMemberDialogOpen: boolean) => void;
  selectedMemberForRemoval: string | null;
  setSelectedMemberForRemoval: (selectedMemberForRemoval: string | null) => void;
  selectedMemberNameForRemoval: string | null;
  setSelectedMemberNameForRemoval: (selectedMemberNameForRemoval: string | null) => void;
  isRemovalComboboxOpen: boolean;
  setIsRemovalComboboxOpen: (isRemovalComboboxOpen: boolean) => void;
  addToBlackList: boolean;
  setAddToBlackList: (addToBlackList: boolean) => void;
  handleOpenPermissionDialog: () => Promise<void>;
  handleGrantPermission: () => Promise<void>;
  handleOpenRemoveMemberDialog: () => Promise<void>;
  handleRemoveMember: () => Promise<void>;
};

/**
 * グループメンバーのフック
 * @param groupId {string} グループID
 * @param isGroupOwner {boolean} グループオーナーかどうか
 * @param isAppOwner {boolean} アプリオーナーかどうか
 */
export function useGroupMembers({ groupId, isGroupOwner, isAppOwner }: UseGroupMembersProps): UseGroupMembersReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  const router = useRouter();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [groupMembers, setGroupMembers] = useState<GroupMemberWithUser[]>([]);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] = useState<string | null>(null);
  const [selectedMemberNameForRemoval, setSelectedMemberNameForRemoval] = useState<string | null>(null);
  const [isRemovalComboboxOpen, setIsRemovalComboboxOpen] = useState(false);
  const [addToBlackList, setAddToBlackList] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  return {
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
  };
}
