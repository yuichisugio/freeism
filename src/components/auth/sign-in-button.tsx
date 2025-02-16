"use client";

import type { ComponentPropsWithoutRef } from "react";
import { signIn } from "next-auth/react";

// import { signIn } from "@/auth";ではダメだった。

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
type SignInButtonProps = {
  provider: "google";
} & ComponentPropsWithoutRef<"button">;

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
export function SignInButton({
  provider,
  children,
  ...props
}: SignInButtonProps) {
  function handleClick() {
    signIn(provider, { callbackUrl: "/dashboard" });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
