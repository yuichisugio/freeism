"use client";

import type { ComponentPropsWithoutRef } from "react";
import { memo, useCallback, useState } from "react";
import { signIn } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
type SignInButtonProps = ComponentPropsWithoutRef<"button">;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * サインインボタンコンポーネント
 * - Googleアカウントでのサインインを提供
 * - クライアントサイドでの認証処理を実行
 * - サインイン後はトップページにリダイレクト
 */
export const SignInButton = memo(function SignInButton({ children, ...props }: SignInButtonProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const [isLoading, setIsLoading] = useState(false);

  /**
   * サインインボタンのクリックハンドラ
   */
  const handleClick = useCallback(() => {
    try {
      setIsLoading(true);
      void signIn("google", { callbackUrl: "/dashboard/grouplist" });
    } catch (error) {
      console.error("サインインに失敗しました:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サインインボタンを表示
   */
  return (
    <button type="button" disabled={isLoading} onClick={handleClick} {...props}>
      {isLoading ? "サインイン中..." : children}
    </button>
  );
});
