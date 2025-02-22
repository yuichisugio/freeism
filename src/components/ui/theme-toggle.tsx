"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // クライアント側でのみマウントされたことを検知する
  useEffect(() => {
    setMounted(true);
  }, []);

  // mounted になる前は何もレンダリングしない。それによりクライアントとサーバーコンポーネントのテーマのハイドレーションのエラーを防ぐ
  if (!mounted) {
    return null;
  }

  // テーマを順番に切り替える関数
  const toggleTheme = () => {
    if (theme === "system") {
      setTheme("light");
    } else if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("system");
    }
  };

  // 現在のテーマに応じたアイコンを表示
  const ThemeIcon = () => {
    switch (theme) {
      case "light":
        return (
          <>
            <Sun className="h-5 w-5" />
            <span className="text-sm">Light</span>
          </>
        );
      case "dark":
        return (
          <>
            <Moon className="h-5 w-5" />
            <span className="text-sm">Dark</span>
          </>
        );
      default:
        return (
          <>
            <Monitor className="h-5 w-5" />
            <span className="text-sm">System</span>
          </>
        );
    }
  };

  return (
    <Button variant="outline" size="default" onClick={toggleTheme} className="button-outline-custom" aria-label="テーマ切り替え">
      <ThemeIcon />
    </Button>
  );
}
