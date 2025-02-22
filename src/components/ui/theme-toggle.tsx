"use client";

import { Button } from "@/components/ui/button";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

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
    <Button variant="outline" size="default" onClick={toggleTheme} className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 dark:hover:text-blue-200" aria-label="テーマ切り替え">
      <ThemeIcon />
    </Button>
  );
}
