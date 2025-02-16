"use client";

import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
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
 * サインインリンクコンポーネントの型定義
 * - a属性に渡されるPropsに、ProviderもPropsとして渡せるように型拡張している
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
type SignInLinkProps = {
  provider: "google";
} & ComponentPropsWithoutRef<"a">;

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

/**
 * サインインリンクコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
export function SignInLink({ provider, children, ...props }: SignInLinkProps) {
  function handleClick() {
    signIn(provider, { callbackUrl: "/dashboard" });
  }

  return (
    <Link href="#" onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
