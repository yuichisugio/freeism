"use server";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";
import { type UserSettings } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーの参加グループを取得
 * @returns ユーザーの参加グループ
 */
export async function getUserGroups() {
  const userId = await getAuthenticatedSessionUserId();

  return prisma.groupMembership.findMany({
    where: { userId },
    select: {
      group: { select: { id: true, name: true } },
    },
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を取得
 */
export const getUserSettings = cache(async (userId: string): Promise<UserSettings | null> => {
  console.log("src/components/auth/setup-form.tsx_getUserSettings_userId", userId);
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: userId },
  });
  console.log("src/components/auth/setup-form.tsx_getUserSettings_userSettings", userSettings);
  return userSettings;
});
