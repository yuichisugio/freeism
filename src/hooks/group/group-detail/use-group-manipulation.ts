"use client";

import type { Group } from "@/types/group-types";
import { useCallback, useEffect, useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { deleteGroup, joinGroup, removeMember } from "@/actions/group/group";
import { getGroupById } from "@/actions/group/group-detail";
import { leaveGroup } from "@/actions/group/my-group";
import { queryCacheKeys } from "@/library-setting/tanstack-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのフックの戻り値の型
 */
type UseGroupDetailReturn = {
  // state
  group: Group | null;
  isMember: boolean;
  deleteDialogOpen: boolean;
  leaveDialogOpen: boolean;
  editDialogOpen: boolean;
  removeMemberDialogOpen: boolean;
  selectedMemberForRemoval: string | null;
  selectedMemberNameForRemoval: string | null;
  isRemovalComboboxOpen: boolean;
  addToBlackList: boolean;
  isLoadingGroup: boolean;
  // mutation states
  isJoiningGroup: boolean;
  isLeavingGroup: boolean;
  isDeletingGroup: boolean;
  isRemovingMember: boolean;

  // action dialog setters
  setDeleteDialogOpen: (open: boolean) => void;
  setLeaveDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  setRemoveMemberDialogOpen: (open: boolean) => void;
  setSelectedMemberForRemoval: (id: string | null) => void;
  setSelectedMemberNameForRemoval: (name: string | null) => void;
  setIsRemovalComboboxOpen: (open: boolean) => void;
  setAddToBlackList: (add: boolean) => void;

  // functions
  handleJoinGroup: (groupId: string) => void;
  handleLeave: () => void;
  executeLeaveGroup: (groupId: string) => void;
  handleOpenEditDialog: () => void;
  handleOpenDeleteDialog: () => void;
  handleDeleteGroup: (groupId: string) => void;
  handleOpenRemoveMemberDialog: () => Promise<void>;
  handleRemoveMember: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ詳細ページのフック
 * @param tasks {Task[]} タスクデータ
 * @param isOwner {boolean} オーナーかどうか
 * @param groupId {string} グループID
 * @returns {UseGroupDetailReturn} グループ詳細ページのフックの戻り値
 */
export function useGroupManipulation({
  isOwner,
  groupId,
}: {
  isOwner: boolean;
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
  // メンバー
  const [isMember, setIsMember] = useState(false);
  // 削除ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // 脱退ダイアログ
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  // 編集ダイアログ
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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
   * グループ情報を取得
   */
  const { data: group, isPending: isLoadingGroup } = useQuery({
    queryKey: queryCacheKeys.tasks.byGroupId(groupId),
    queryFn: async () => await getGroupById(groupId),
    staleTime: 1000 * 60 * 60 * 24, // 24時間
    gcTime: 1000 * 60 * 60 * 24, // 24時間
    enabled: !!groupId,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンポーネントマウント時に権限チェックを一度だけ実行
   */
  useEffect(() => {
    async function checkPermissions() {
      if (!userId) {
        // redirect("/auth/signin"); // ここでリダイレクトするとセッション取得前にエラーになる可能性
        return;
      }

      // ユーザーがグループのメンバーかどうかチェック
      // tasksが初期状態で空またはgroupが存在しない場合を考慮
      if (group?.members) {
        const memberIds = group.members.map((member: { userId: string }) => member.userId);
        setIsMember(memberIds.includes(userId));
      }
    }

    void checkPermissions();
  }, [groupId, userId, group?.members]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加処理
   * @param groupId {string} グループID
   */
  const { mutate: joinGroupMutation, isPending: isJoiningGroup } = useMutation({
    mutationFn: async (currentGroupId: string) => await joinGroup(currentGroupId),
    onSuccess: async () => {
      setIsMember(true);
      router.refresh();
    },
    meta: {
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.tasks.byGroupId(groupId), exact: false },
        { queryKey: queryCacheKeys.table.allGroup(), exact: true },
        { queryKey: queryCacheKeys.table.myGroup(), exact: true },
        { queryKey: queryCacheKeys.users.joinedGroupIds(userId), exact: true },
      ],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加処理
   */
  const handleJoinGroup = useCallback(
    (currentGroupId: string) => {
      joinGroupMutation(currentGroupId);
    },
    [joinGroupMutation],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ脱退処理（ダイアログ表示）
   */
  const handleLeave = useCallback(() => {
    setLeaveDialogOpen(true);
  }, [setLeaveDialogOpen]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 実際のグループ脱退処理を実行
   * @param groupId {string} グループID
   */
  const { mutate: leaveGroupMutation, isPending: isLeavingGroup } = useMutation({
    mutationFn: async (currentGroupId: string) => await leaveGroup(currentGroupId, userId ?? ""),
    onSuccess: async () => {
      setIsMember(false);
      setLeaveDialogOpen(false);
      router.refresh();
    },
    onError: () => {
      setLeaveDialogOpen(false); // エラー時もダイアログを閉じる
    },
    meta: {
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.tasks.byGroupId(groupId), exact: true },
        { queryKey: queryCacheKeys.table.allGroup(), exact: true },
        { queryKey: queryCacheKeys.table.myGroup(), exact: true },
        { queryKey: queryCacheKeys.users.joinedGroupIds(userId), exact: true },
      ],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報編集ダイアログを開く処理
   */
  const handleOpenEditDialog = useCallback(() => {
    // 保存された権限情報を使用
    if (!isOwner) {
      toast.error("権限がありません");
      return;
    }

    setEditDialogOpen(true);
  }, [isOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ削除ダイアログを開く処理
   */
  const handleOpenDeleteDialog = useCallback(() => {
    // 保存された権限情報を使用
    if (!isOwner) {
      toast.error("権限がありません");
      return;
    }

    setDeleteDialogOpen(true);
  }, [isOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ削除処理
   */
  const { mutate: deleteGroupMutation, isPending: isDeletingGroup } = useMutation({
    mutationFn: async (currentGroupId: string) => await deleteGroup(currentGroupId),
    onSuccess: async () => {
      setDeleteDialogOpen(false); // ダイアログを閉じる
      router.push("/dashboard/group-list");
    },
    onError: () => {
      setDeleteDialogOpen(false); // エラー時もダイアログを閉じる
    },
    meta: {
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.tasks.byGroupId(groupId), exact: false },
        { queryKey: queryCacheKeys.table.allGroup(), exact: true },
        { queryKey: queryCacheKeys.table.myGroup(), exact: true },
      ],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ削除処理
   */
  const handleDeleteGroup = useCallback(
    (currentGroupId: string) => {
      if (!isOwner) {
        toast.error("権限がありません");
        return;
      }
      deleteGroupMutation(currentGroupId);
    },
    [isOwner, deleteGroupMutation],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メンバー除名ダイアログを開く処理
   */
  const handleOpenRemoveMemberDialog = useCallback(async () => {
    if (!isOwner) {
      toast.error("権限がありません");
      return;
    }
    setRemoveMemberDialogOpen(true);
  }, [isOwner]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メンバー除名処理
   */
  const { mutate: removeMemberMutation, isPending: isRemovingMember } = useMutation({
    mutationFn: async () => {
      if (!selectedMemberForRemoval) {
        // このケースはUI側で制御されるべきだが、念のため
        throw new Error("除名するメンバーが選択されていません。");
      }
      return await removeMember(groupId, selectedMemberForRemoval, addToBlackList);
    },
    onSuccess: async () => {
      setRemoveMemberDialogOpen(false);
      setSelectedMemberForRemoval(null);
      setSelectedMemberNameForRemoval(null);
      setAddToBlackList(false);
      router.refresh();
    },
    meta: {
      invalidateCacheKeys: [
        { queryKey: queryCacheKeys.permission.members(groupId), exact: true },
        { queryKey: queryCacheKeys.tasks.byGroupId(groupId), exact: true },
      ],
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * メンバー除名処理
   */
  const handleRemoveMember = useCallback(() => {
    if (!isOwner) {
      toast.error("権限がありません");
      return;
    }

    if (!selectedMemberForRemoval) {
      toast.error("メンバーを選択してください");
      return;
    }
    removeMemberMutation();
  }, [isOwner, selectedMemberForRemoval, removeMemberMutation]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    group: group ?? null,
    isLoadingGroup,
    isMember,
    deleteDialogOpen,
    leaveDialogOpen,
    editDialogOpen,
    removeMemberDialogOpen,
    selectedMemberForRemoval,
    selectedMemberNameForRemoval,
    isRemovalComboboxOpen,
    addToBlackList,

    // mutation states
    isJoiningGroup,
    isLeavingGroup,
    isDeletingGroup,
    isRemovingMember,

    // action dialog setters
    setDeleteDialogOpen,
    setLeaveDialogOpen,
    setEditDialogOpen,
    setRemoveMemberDialogOpen,
    // action state setters for remove member dialog
    setSelectedMemberForRemoval,
    setSelectedMemberNameForRemoval,
    setIsRemovalComboboxOpen,
    setAddToBlackList,

    // functions
    handleJoinGroup,
    handleLeave,
    executeLeaveGroup: leaveGroupMutation,
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleDeleteGroup,
    handleOpenRemoveMemberDialog,
    handleRemoveMember,
  };
}
