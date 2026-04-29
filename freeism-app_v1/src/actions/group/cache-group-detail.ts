"use cache";

import type { Group } from "@/types/group-types";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ情報を取得
 * @param groupId {string} グループID
 * @returns {Promise<Group>} グループ情報
 */
export async function getCachedGroupById(groupId: string): PromiseResult<Group> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループIDがあるかチェック
   */
  if (!groupId) {
    throw new Error("グループIDがありません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報を取得
   */
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      goal: true,
      evaluationMethod: true,
      depositPeriod: true,
      maxParticipants: true,
      members: {
        select: { userId: true },
      },
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループが見つからない場合はエラー
   */
  if (!group) {
    throw new Error("グループが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報を整形
   */
  const returnGroup: Group = {
    id: group.id,
    name: group.name,
    goal: group.goal,
    evaluationMethod: group.evaluationMethod,
    joinMemberCount: group.members.length,
    maxParticipants: group.maxParticipants,
    depositPeriod: group.depositPeriod,
    members: group.members.map((member) => ({
      userId: member.userId,
    })),
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * グループ情報を返却
   */
  return {
    success: true,
    message: "グループ情報を取得しました",
    data: returnGroup,
  };
}
