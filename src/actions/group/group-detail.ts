"use server";

import type { Group } from "@/types/group-types";
import { getCachedGroupById } from "@/actions/group/cache-group-detail";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループ情報を取得
 * @param groupId {string} グループID
 * @returns {Promise<Group>} グループ情報
 */
export async function getGroupById(groupId: string): PromiseResult<Group> {
  return await getCachedGroupById(groupId);
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
