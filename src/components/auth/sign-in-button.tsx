"use client";

import type { ComponentPropsWithoutRef } from "react";
import { signIn } from "next-auth/react";

// import { signIn } from "@/auth";
// import { signIn } from "@/auth";ではダメだった。

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
type SignInButtonProps = ComponentPropsWithoutRef<"button">;

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
export function SignInButton({ children, ...props }: SignInButtonProps) {
  function handleClick() {
    try {
      void signIn("google", { callbackUrl: "/dashboard/grouplist" });
    } catch (error) {
      console.error("サインインに失敗しました:", error);
    }
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
