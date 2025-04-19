"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加グループを取得
 * @returns ユーザーの参加グループ
 */
export async function getUserGroups() {
  const userId = await getAuthenticatedSessionUserId();

  return prisma.groupMembership.findMany({
    where: { userId },
    include: { group: true },
  });
}
