"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * Googleサインインアクション
 * - サーバーサイドで実行される認証アクション
 * - Googleアカウントでのサインインを処理
 * - サインイン後はトップページにリダイレクト
 * - Next.js 14以降では、サーバーコンポーネント内でサーバーアクションを定義・使用することができます。
 * ただし、現在の実装には潜在的な問題があります：
サーバーコンポーネント内で直接フォームアクションを定義すると、そのコンポーネントが再レンダリングされるたびに新しいアクションが作成されます
これはパフォーマンスの観点から好ましくありません。なので、別ファイルのサーバーコンポーネントを作成して、それを渡す方が良い
 */

const setupSchema = z.object({
  username: z.string().min(2).max(30),
  lifeGoal: z.string().min(10).max(200),
  groupName: z.string().min(2).max(30),
  evaluationMethod: z.string().min(10).max(200),
});

export async function updateUserSetup(data: {
  username: string;
  lifeGoal: string;
  groupName: string;
  evaluationMethod: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "ユーザーが認証されていません。" };
    }

    // ユーザー設定を更新または作成
    await prisma.userSettings.upsert({
      where: {
        userId: session.user.id,
      },
      update: {
        username: data.username,
        lifeGoal: data.lifeGoal,
        groupName: data.groupName,
        evaluationMethod: data.evaluationMethod,
      },
      create: {
        userId: session.user.id,
        username: data.username,
        lifeGoal: data.lifeGoal,
        groupName: data.groupName,
        evaluationMethod: data.evaluationMethod,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating user setup:", error);
    return {
      success: false,
      error: "設定の更新中にエラーが発生しました。",
    };
  }
}
