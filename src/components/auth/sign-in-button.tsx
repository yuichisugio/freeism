"use client";

import type { ComponentPropsWithoutRef } from "react";
import { signIn } from "next-auth/react";

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
export async function SignInButton({
  provider,
  children,
  ...props
}: SignInButtonProps) {
  async function handleClick() {
    await signIn(provider, { callbackUrl: "/" });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
