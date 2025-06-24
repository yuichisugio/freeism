"use client";

import type { GetGroupMembers } from "@/types/group-types";
import { useCallback, useState } from "react";
import { redirect } from "next/navigation";
import { getGroupMembers } from "@/lib/actions/group/group";
import { checkIsPermission, grantOwnerPermission } from "@/lib/actions/permission";
import { queryCacheKeys } from "@/lib/tanstack-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフック
 */
type UseGroupPermissionProps = {
  groupId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフックの戻り値
 */
type UseGroupPermissionReturn = {
  // state
  isOwner: boolean;
  groupMembers: GetGroupMembers[];
  showPermissionDialog: boolean;
  addToBlackList: boolean;
  selectedUserId: string | null;
  selectedUserName: string | null;
  isComboboxOpen: boolean;
  removeMemberDialogOpen: boolean;
  selectedMemberForRemoval: string | null;
  selectedMemberNameForRemoval: string | null;
  isRemovalComboboxOpen: boolean;
  isLoadingPermissions: boolean;

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
  handleOpenPermissionDialog: () => void;
  handleGrantPermission: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーのフック
 * @param groupId {string} グループID
 */
export function useGroupPermission({ groupId }: UseGroupPermissionProps): UseGroupPermissionReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * クエリクライアント
   */
  const queryClient = useQueryClient();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
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
   * グループオーナー権限の取得
   */
  const { data: isOwner, isLoading: isLoadingOwner } = useQuery({
    queryKey: queryCacheKeys.permission.groupOwner(groupId, userId),
    queryFn: async () => await checkIsPermission(userId, groupId, undefined, false),
    enabled: !!userId && !!groupId,
    staleTime: 1000 * 60 * 60 * 24, // 24時間
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーの取得
   */
  const { data: groupMembers = [], refetch: refetchGroupMembers } = useQuery<GetGroupMembers[], Error>({
    queryKey: queryCacheKeys.permission.members(groupId),
    queryFn: async () => await getGroupMembers(groupId),
    enabled: false,
    staleTime: 1000 * 60 * 60 * 24, // 24時間
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限付与ダイアログを開く処理
   */
  const handleOpenPermissionDialog = useCallback(() => {
    if (!isOwner) {
      toast.error("権限がありません");
      return;
    }
    setShowPermissionDialog(true);
    try {
      void refetchGroupMembers();
    } catch (error) {
      console.error(error);
      toast.error("メンバー情報の取得に失敗しました");
    }
  }, [isOwner, refetchGroupMembers]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限付与処理
   */
  const { mutate: grantPermissionMutation, isPending: isGrantingPermission } = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) {
        throw new Error("メンバーを選択してください");
      }
      return await grantOwnerPermission(groupId, selectedUserId);
    },
    onSuccess: async (result) => {
      if (result.success) {
        toast.success("権限を付与しました");
        setShowPermissionDialog(false);
        setSelectedUserId(null);
        setSelectedUserName(null);
        setIsComboboxOpen(false);
        // グループオーナー権限とメンバーリストのキャッシュを無効化して再取得
        await queryClient.invalidateQueries({ queryKey: queryCacheKeys.permission.groupOwner(groupId, userId) });
        await queryClient.invalidateQueries({ queryKey: queryCacheKeys.permission.members(groupId) });
        // router.refresh();
      } else if (result.message) {
        toast.error(result.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
      console.error(error);
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限付与処理
   */
  const handleGrantPermission = useCallback(() => {
    if (!isOwner) {
      toast.error("権限がありません");
      return;
    }
    if (!selectedUserId) {
      toast.error("メンバーを選択してください");
      return;
    }
    grantPermissionMutation();
  }, [isOwner, selectedUserId, grantPermissionMutation]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループメンバーのフックの戻り値
   */
  return {
    // state
    isOwner: isOwner?.success ?? false,
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
    isLoadingPermissions: isLoadingOwner || isGrantingPermission,

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
