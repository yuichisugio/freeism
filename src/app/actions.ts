"use server";

import type { SetupForm } from "@/components/auth/setup-form";
import type { CreateGroupFormData } from "@/components/group/create-group-form";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export async function createGroup(data: CreateGroupFormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "ユーザーが認証されていません。" };
    }

    await prisma.group.create({
      data: {
        name: data.name,
        goal: data.goal,
        evaluationMethod: data.evaluationMethod,
        maxParticipants: data.maxParticipants,
        createdBy: session.user.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating group:", error);
    return {
      success: false,
      error: "グループの作成中にエラーが発生しました。",
    };
  }
}
