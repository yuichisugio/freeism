"use client";

import { useCallback, useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { getGroupList, getUserJoinGroupIds, joinGroup } from "@/lib/actions/group";
import { type Group } from "@/types/group-types";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加処理のためのカスタムフック
 * @returns グループ参加関連機能
 */
export function useAllUserGroupTable() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加関連機能
   */
  const [groups, setGroups] = useState<Group[]>([]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * セッションのユーザーIDを取得
   */
  const { data: session } = useSession();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加関連機能
   */
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        // グループ一覧を取得（参加状況も含める）
        const groupsData = await getGroupList();
        const userJoinGroupIds = await getUserJoinGroupIds(userId);
        const joinedGroupIds = userJoinGroupIds.map((group) => group.groupId);
        setGroups(groupsData.map((group) => ({ ...group, isJoined: joinedGroupIds.includes(group.id) })));
      } catch (error) {
        console.error("Failed to fetch groups:", error);
        toast.error("グループの取得に失敗しました。");
      }
    };
    void fetchGroups();
  }, [userId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加処理
   * @param groupId - 参加するグループID
   */
  const handleJoin = useCallback(
    async (groupId: string) => {
      try {
        // グループに参加する。
        const result = await joinGroup(groupId);

        if (result.success) {
          toast.success("グループに参加しました");
          // 参加状態を更新
          setGroups((prev) =>
            prev.map((group) =>
              // 参加したグループに参加状態を追加
              group.id === groupId ? { ...group, isJoined: true } : group,
            ),
          );
        } else if (result.error) {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error("エラーが発生しました");
        console.error(error);
      }
    },
    [setGroups],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加関連機能
   */
  return {
    // state
    groups,

    // function
    setGroups,
    handleJoin,
  };
}
