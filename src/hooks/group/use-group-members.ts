"use client";

import type { GroupMemberWithUser } from "@/lib/actions/group";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getGroupMembers, grantOwnerPermission, removeMember } from "@/lib/actions/group";
import { toast } from "sonner";

type UseGroupMembersProps = {
  groupId: string;
  isGroupOwner: boolean;
  isAppOwner: boolean;
};

export function useGroupMembers({ groupId, isGroupOwner, isAppOwner }: UseGroupMembersProps) {
  const router = useRouter();
  const [groupMembers, setGroupMembers] = useState<GroupMemberWithUser[]>([]);

  // 権限付与関連
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  // メンバー除名関連
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [selectedMemberForRemoval, setSelectedMemberForRemoval] = useState<string | null>(null);
  const [selectedMemberNameForRemoval, setSelectedMemberNameForRemoval] = useState<string | null>(null);
  const [isRemovalComboboxOpen, setIsRemovalComboboxOpen] = useState(false);
  const [addToBlackList, setAddToBlackList] = useState(false);

  // 権限付与ダイアログを開く処理
  async function handleOpenPermissionDialog() {
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
  }

  // 権限付与処理
  async function handleGrantPermission() {
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
  }

  // メンバー除名ダイアログを開く処理
  async function handleOpenRemoveMemberDialog() {
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
  }

  // メンバー除名処理
  async function handleRemoveMember() {
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
  }

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
