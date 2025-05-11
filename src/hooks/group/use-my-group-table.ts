"use client";

import { useCallback, useEffect, useState } from "react";
import { getUserJoinGroupData, leaveGroup } from "@/lib/actions/group";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * MyGroupMembership のための型定義
 */
type MembershipTask = {
  fixedContributionPoint: number | null;
};

/**
 * MembershipGroup のための型定義
 */
type MembershipGroup = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  tasks: MembershipTask[];
};

/**
 * MyGroupMembership のための型定義
 */
export type MyGroupMembership = {
  id: string;
  group: MembershipGroup;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ脱退処理のためのカスタムフック
 * @returns グループ脱退関連機能
 */
export function useMyGroupTable() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 参加しているグループ一覧
   */
  const [memberships, setMemberships] = useState<MyGroupMembership[]>([]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 参加しているグループ一覧を取得
   */
  useEffect(() => {
    const fetchMemberships = async () => {
      const membershipsData = await getUserJoinGroupData();
      setMemberships(membershipsData as MyGroupMembership[]);
    };
    void fetchMemberships();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ脱退処理
   * @param groupId - 脱退するグループID
   */
  const handleLeave = useCallback(async (groupId: string) => {
    try {
      const result = await leaveGroup(groupId);

      if (result.success) {
        toast.success("グループから脱退しました");
        setMemberships((prev) => prev.filter((membership) => membership.group.id !== groupId));
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("エラーが発生しました");
      console.error(error);
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループごとの保有ポイントを計算
   */
  const calculateTotalPointsByGroup = useCallback(() => {
    if (!memberships) return {};
    return memberships.reduce(
      (acc: Record<string, number>, membership: MyGroupMembership) => {
        const groupId = membership.group.id;
        const groupContributionPoints = membership.group.tasks.reduce(
          (sum: number, task: MembershipTask) => sum + (task.fixedContributionPoint ?? 0),
          0,
        );
        acc[groupId] = groupContributionPoints;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [memberships]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ脱退関連機能
   */
  return {
    // state
    memberships,

    // 関数
    setMemberships,
    handleLeave,
    calculateTotalPointsByGroup,
  };
}
