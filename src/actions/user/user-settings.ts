"use server";

import type { SetupForm } from "@/components/setting/setup-form";
import type { UserSettings } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/library-setting/prisma";
import { type PromiseResult } from "@/types/general-types";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新パラメータ
 */
export type UpdateUserSettingToggleParams = {
  userId: string;
  isEnabled: boolean;
  column: "isEmailEnabled" | "isPushEnabled";
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定の更新結果
 */
type UpdateUserSettingToggleResult = {
  id: string;
  userId: string;
} & Record<"isEmailEnabled" | "isPushEnabled", boolean>;

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
): PromiseResult<UpdateUserSettingToggleResult> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
    data: {
      id: userSettings.id,
      userId: userSettings.userId,
      [column]: isEnabled,
    } as UpdateUserSettingToggleResult,
    message: "ユーザー設定を更新しました",
    success: true,
  };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を更新または作成する関数
 * @param data - フォームから送信されたデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateUserSetup(data: SetupForm, userId: string): PromiseResult<null> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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
  return { success: true, data: null, message: "ユーザー設定を更新しました" };
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を取得
 */
export const getUserSettings = cache(async (userId: string): PromiseResult<UserSettings | null> => {
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
  return { success: true, data: userSettings, message: "ユーザー設定を取得しました" };
});
