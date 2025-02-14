"use client";

import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
export function SignInButton() {
  return (
    <Button
      className="bg-blue-600 text-white hover:bg-blue-700"
      onClick={async () => {
        await signIn("google", {
          callbackUrl: "/",
          redirect: true,
        });
      }}
    >
      サインイン
    </Button>
  );
}
