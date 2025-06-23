"use server";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加グループを取得
 * @returns ユーザーの参加グループ
 */
export const getUserGroups = cache(async (userId: string) => {
  if (!userId) throw new Error("userId is required");

  return prisma.groupMembership.findMany({
    where: { userId },
    select: {
      group: { select: { id: true, name: true } },
    },
  });
});
