"use server";

import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新
 * @param userId ユーザーID
 * @param isEnabled 有効/無効
 * @param column 更新するカラム
 * @returns 更新結果
 */
export async function updateUserSettings(userId: string, isEnabled: boolean, column: "isEmailEnabled" | "isPushEnabled"): Promise<{ success: boolean; data?: { id: string; userId: string; [column]: boolean }; error?: string }> {
  console.log(userId, isEnabled, column);

  try {
    // ユーザー設定の更新
    const userSettings = await prisma.userSettings.update({
      where: { userId },
      data: { [column]: isEnabled },
    });

    // JSONシリアライズ可能なオブジェクトを返す
    return {
      success: true,
      data: {
        id: userSettings.id,
        userId: userSettings.userId,
        [column]: isEnabled,
      },
    };
  } catch (error) {
    console.error("ユーザー設定の更新に失敗しました:", error);
    // エラー情報をシリアライズ可能な形式で返す
    return {
      success: false,
      error: error instanceof Error ? error.message : "不明なエラーが発生しました",
    };
  }
}
