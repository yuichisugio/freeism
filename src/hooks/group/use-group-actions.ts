"use client";

import { useCallback, useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { type Group } from "@/components/group/group-list-table";
import { joinGroup, leaveGroup } from "@/lib/actions/group";
import { prisma } from "@/lib/prisma";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ参加処理のためのカスタムフック
 * @returns グループ参加関連機能
 */
export function useGroupJoiner() {
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
    redirect("auth/signin");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加関連機能
   */
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        // グループ一覧を取得（参加状況も含める）
        const groupsData = await prisma.group.findMany({
          select: {
            id: true,
            name: true,
            goal: true,
            evaluationMethod: true,
            maxParticipants: true,
            members: {
              where: {
                userId: userId,
              },
              select: {
                id: true,
              },
            },
            createdBy: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });
        setGroups(groupsData);
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ参加関連機能
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ脱退関連機能
   */
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
