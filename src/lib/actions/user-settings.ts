"use server";

import type { SetupForm } from "@/components/setting/setup-form";
import type { UserSettings } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedSessionUserId } from "@/lib/utils";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新
 * @param userId ユーザーID
 * @param isEnabled 有効/無効
 * @param column 更新するカラム
 * @returns 更新結果
 */
export async function updateUserSettingToggle(
  userId: string,
  isEnabled: boolean,
  column: "isEmailEnabled" | "isPushEnabled",
): Promise<{ success: boolean; data?: { id: string; userId: string; [column]: boolean }; error?: string }> {
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を更新または作成する関数
 * @param data - フォームから送信されたデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateUserSetup(data: SetupForm) {
  try {
    // 認証セッションを取得
    const userId = await getAuthenticatedSessionUserId();

    // フォームの回答内容をデータベースに保存する。更新or新規作成
    await prisma.userSettings.upsert({
      where: {
        userId: userId,
      },
      update: {
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
      create: {
        userId: userId,
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
    });

    // 保存が成功した場合
    return { success: true, redirect: "/dashboard/grouplist" };
  } catch (error) {
    // エラーログを出力
    console.error("Error updating user setup:", error);
    return { success: false, error: "設定の更新中にエラーが発生しました。" };
  }
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を取得
 */
export const getUserSettings = cache(async (userId: string): Promise<UserSettings | null> => {
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: userId },
  });
  return userSettings;
});
