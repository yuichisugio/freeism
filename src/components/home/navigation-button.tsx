"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type NavigationButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ローディング状態付きのナビゲーションボタン
 * サーバーコンポーネント内で、一部だけクライアントコンポーネントを使用したい場合に使用する
 * @param href - 遷移先URL
 * @param children - ボタンの内容
 * @param variant - ボタンのバリアント
 * @param size - ボタンのサイズ
 * @param className - 追加のCSSクラス
 * @returns ナビゲーションボタン
 */
export function NavigationButton({
  href,
  children,
  variant = "outline",
  size = "lg",
  className = "",
}: NavigationButtonProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ナビゲーション処理
   */
  const handleNavigation = () => {
    setIsLoading(true);
    router.push(href);
  };

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <Button variant={variant} size={size} className={className} onClick={handleNavigation} disabled={isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          読み込み中...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
