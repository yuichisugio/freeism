"use server";

import type { SetupForm } from "@/components/setting/setup-form";
import type { UserSettings } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新パラメータ
 */
type UpdateUserSettingToggleParams = {
  userId: string;
  isEnabled: boolean;
  column: "isEmailEnabled" | "isPushEnabled";
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新結果
 */
type UpdateUserSettingToggleResult = {
  success: boolean;
  data: {
    id: string;
    userId: string;
  } & Record<"isEmailEnabled" | "isPushEnabled", boolean>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新
 * @param userId ユーザーID
 * @param isEnabled 有効/無効
 * @param column 更新するカラム
 * @returns 更新結果
 */
export async function updateUserSettingToggle(
  params: UpdateUserSettingToggleParams,
): Promise<UpdateUserSettingToggleResult> {
  /**
   * パラメータの検証
   */
  if (!params) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの分解
   */
  const { userId, isEnabled, column } = params;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (
    !userId ||
    typeof userId !== "string" ||
    isEnabled === undefined ||
    isEnabled === null ||
    typeof isEnabled !== "boolean" ||
    typeof column !== "string" ||
    !["isEmailEnabled", "isPushEnabled"].includes(column)
  ) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定の更新
   */
  const userSettings = await prisma.userSettings.update({
    where: { userId },
    data: { [column]: isEnabled },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 更新結果を返す
   */
  return {
    success: true,
    data: {
      id: userSettings.id,
      userId: userSettings.userId,
      [column]: isEnabled,
    } as UpdateUserSettingToggleResult["data"],
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を更新または作成する関数
 * @param data - フォームから送信されたデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateUserSetup(
  data: SetupForm,
  userId: string,
): Promise<{ success: boolean; redirectURL: string }> {
  /**
   * パラメータの検証
   */
  if (!data || !userId) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * フォームの回答内容をデータベースに保存する。更新or新規作成
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 保存が成功した場合
   */
  return { success: true, redirectURL: "/dashboard/grouplist" };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を取得
 */
export const getUserSettings = cache(async (userId: string): Promise<UserSettings | null> => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * パラメータの検証
   */
  if (!userId) {
    throw new Error("無効なパラメータが指定されました");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を取得
   */
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: userId },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ユーザー設定を返す
   */
  return userSettings;
});
