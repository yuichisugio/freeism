"use client";

import { useCallback, useState } from "react";
import { joinGroup, leaveGroup } from "@/lib/actions/group";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加処理のためのカスタムフック
 * @returns グループ参加関連機能
 */
export function useGroupJoiner<T extends Record<string, unknown>>(initialGroups: T[]) {
  const [groups, setGroups] = useState<T[]>(initialGroups);

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
              // 参加したグループに仮のメンバー情報を追加
              group.id === groupId ? { ...group, members: [{ id: "temp" }] } : group,
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

  return {
    groups,
    setGroups,
    handleJoin,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ脱退処理のためのカスタムフック
 * @param initialMemberships - 初期メンバーシップデータ
 * @returns グループ脱退関連機能
 */
export function useGroupLeaver<T extends Record<string, unknown>>(initialMemberships: T[]) {
  const [memberships, setMemberships] = useState<T[]>(initialMemberships);

  /**
   * グループ脱退処理
   * @param groupId - 脱退するグループID
   */
  const handleLeave = useCallback(
    async (groupId: string) => {
      try {
        const result = await leaveGroup(groupId);

        if (result.success) {
          toast.success("グループから脱退しました");
          // 脱退したグループを一覧から削除
          setMemberships((prev) => prev.filter((membership) => (membership.group as { id: string })?.id !== groupId));
        } else if (result.error) {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error("エラーが発生しました");
        console.error(error);
      }
    },
    [setMemberships],
  );

  return {
    memberships,
    setMemberships,
    handleLeave,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのポイント計算機能
 * @param memberships - メンバーシップデータ
 * @param memberships[].group - グループデータ
 * @param memberships[].group.tasks - タスクデータ
 * @param memberships[].group.tasks[].fixedContributionPoint - 固定評価者による評価ポイント
 * @returns グループ別ポイント計算結果
 */
export function useGroupPoints<T extends { group: { id: string; tasks: { fixedContributionPoint: number | null }[] } }>(memberships: T[]) {
  // グループごとの保有ポイントを計算
  const calculateTotalPointsByGroup = useCallback(() => {
    return memberships.reduce(
      (acc, membership) => {
        const groupId = membership.group.id;
        const groupContributionPoints = membership.group.tasks.reduce((sum, task) => sum + (task.fixedContributionPoint ?? 0), 0);
        acc[groupId] = groupContributionPoints;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [memberships]);

  return { calculateTotalPointsByGroup };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
