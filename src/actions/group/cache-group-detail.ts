"use cache";

import type { Group } from "@/types/group-types";
import { prisma } from "@/library-setting/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ情報を取得
 * @param groupId {string} グループID
 * @returns {Promise<Group>} グループ情報
 */
export async function getCachedGroupById(groupId: string): Promise<Group> {
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

  if (!group) {
    throw new Error("グループが見つかりません");
  }

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

  return returnGroup;
}
