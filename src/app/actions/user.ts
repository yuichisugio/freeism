"use server";

import type { SetupForm } from "@/components/auth/setup-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setupSchema } from "@/lib/zod-schema";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー設定を更新または作成する関数
 * @param data - フォームから送信されたデータ
 * @returns 処理結果を含むオブジェクト
 */
export async function updateUserSetup(data: SetupForm) {
  try {
    // 認証セッションを取得
    const session = await auth();
    // ユーザーが認証されていない場合
    if (!session?.user?.id) {
      return { success: false, error: "ユーザーが認証されていません。" };
    }

    const validatedData = setupSchema.parse(data);
    console.log("validatedData", validatedData);

    // フォームの回答内容をデータベースに保存する。更新or新規作成
    await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        username: data.username,
        lifeGoal: data.lifeGoal,
      },
      create: {
        userId: session.user.id,
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
 * 全ユーザーの一覧を取得する関数
 * @returns ユーザー一覧
 */
export async function getAllUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}
