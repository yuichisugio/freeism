"use server";

import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザーが参加しているグループIDを取得
 * @param userId ユーザーID
 * @returns ユーザーが参加しているグループID
 */
export async function getUserGroupIds(userId: string): PromiseResult<string[]> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーIDがない場合はエラーを投げる
   */
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("userId is required");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループIDを取得
   */
  const userGroupMemberships = await prisma.groupMembership.findMany({
    where: { userId },
    select: { groupId: true },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループIDを返す
   */
  const returnData = userGroupMemberships.map((gm) => gm.groupId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザーが参加しているグループIDを返す
   */
  return { success: true, data: returnData, message: "ユーザーが参加しているグループIDを取得しました" };
}
