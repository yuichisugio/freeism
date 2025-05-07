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

  /**
   * サインインボタンのローディング状態
   */
  const [isLoading, setIsLoading] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * サインインボタンのクリックハンドラ。isLodingをfalseにする必要はない。ログイン後は画面遷移するため。
   */
  const handleClick = useCallback(async () => {
    try {
      setIsLoading(true);
      await signIn("google", { callbackUrl: "/dashboard/grouplist" });
    } catch (error) {
      console.error("サインインに失敗しました:", error);
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
