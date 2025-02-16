"use server";

import { auth, signIn, signOut } from "@/auth";
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
export async function googleSignIn() {
  return signIn();
}

export async function googleSignOut() {
  return signOut();
}

const setupSchema = z.object({
  username: z.string().min(2).max(30),
  lifeGoal: z.string().min(10).max(200),
  groupName: z.string().min(2).max(30),
  evaluationMethod: z.string().min(10).max(200),
});

export async function updateUserSetup(formData: unknown) {
  console.log("updateUserSetup");
  try {
    // セッションからユーザー情報を取得
    const session = await auth();
    console.log("session", session);
    if (!session?.user?.id) {
      console.error("認証されていません。");
      return { error: "認証されていません。" };
    }

    // バリデーション
    const validatedData = setupSchema.parse(formData);

    // ユーザー情報を更新
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: validatedData.username,
        lifeGoal: validatedData.lifeGoal,
        groupName: validatedData.groupName,
        evaluationMethod: validatedData.evaluationMethod,
      },
    });

    return { success: true };
  } catch (error) {
    console.log("error", error);
    if (error instanceof z.ZodError) {
      return { error: "入力内容が正しくありません。" };
    }
    return { error: "予期せぬエラーが発生しました。" };
  }
}
