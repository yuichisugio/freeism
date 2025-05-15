"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { History, Home, Menu, PlusCircle, Settings, ShoppingCart, UserCircle, X } from "lucide-react";
import { signOut } from "next-auth/react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const sidebarItems = [
  {
    title: "Main",
    items: [
      {
        title: "Group一覧",
        href: "/dashboard/grouplist",
        icon: Home,
      },
      {
        title: "Group作成",
        href: "/dashboard/create-group",
        icon: PlusCircle,
      },
      {
        title: "通知作成",
        href: "/dashboard/create-notification",
        icon: PlusCircle,
      },
      {
        title: "Task作成",
        href: "/dashboard/new-task",
        icon: PlusCircle,
      },
      {
        title: "GitHub API変換",
        href: "/dashboard/github-api-conversion",
        icon: PlusCircle,
      },
    ],
  },
  {
    title: "オークション",
    items: [
      {
        title: "商品一覧",
        href: "/dashboard/auction",
        icon: ShoppingCart,
      },
      {
        title: "入札・落札履歴",
        href: "/dashboard/auction/history",
        icon: History,
      },
    ],
  },
  {
    title: "My Info",
    items: [
      {
        title: "参加Group一覧",
        href: "/dashboard/my-group",
        icon: UserCircle,
      },
      {
        title: "Task一覧",
        href: "/dashboard/my-tasks",
        icon: PlusCircle,
      },
    ],
  },
  {
    title: "etc",
    items: [
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
      {
        title: "Logout",
        href: "#",
        icon: Settings,
        isLogout: true,
      },
    ],
  },
];

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * サイドバー
 * @returns サイドバー
 */
export const Sidebar = memo(function Sidebar() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // URL
  const pathname = usePathname();
  // modal
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState(pathname);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * toggle
   */
  const toggleSidebar = useCallback(
    function toggleSidebar() {
      setIsOpen(!isOpen);
    },
    [isOpen],
  );

  useEffect(() => {
    setSelectedPath(pathname);
  }, [pathname]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <AlertDialog>
      {/* モバイル用ハンバーガーボタン（sm:hidden） */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 sm:hidden dark:text-gray-200"
        onClick={toggleSidebar}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* モバイル用オーバーレイ - ヘッダーを白色のままにする */}
      {isOpen && (
        <div
          className="fixed top-16 right-0 bottom-0 left-0 z-40 bg-black/20 backdrop-blur-sm sm:hidden"
          onClick={toggleSidebar}
          onKeyDown={(e) => e.key === "Escape" && toggleSidebar()}
          role="button"
          tabIndex={0}
          aria-label="閉じる"
        />
      )}

      {/* Sidebar本体 - スクロール機能を追加 */}
      <aside
        id="app-sidebar"
        className={cn(
          "sm:static sm:translate-x-0",
          "fixed top-16 left-0 z-45 h-[calc(100vh-4rem)] w-48 border-r border-blue-100 bg-white transition-transform duration-50 dark:border-blue-900 dark:bg-gray-950",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="scrollbar-hide h-full space-y-4 overflow-y-auto py-4">
          {sidebarItems.map((section) => (
            <div key={section.title} className="px-3 py-3">
              <h2 className="text-app px-3 text-lg font-semibold tracking-tight dark:text-gray-200">{section.title}</h2>
              {section.items.map((item) =>
                item.isLogout ? (
                  <AlertDialogTrigger key={item.title} asChild>
                    <Link
                      href={item.href}
                      scroll={false}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "my-1 flex items-center rounded-lg px-3 py-4 text-sm font-medium transition-colors hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-900 dark:hover:text-blue-100",
                        pathname === item.href ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-gray-200",
                      )}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.title}
                    </Link>
                  </AlertDialogTrigger>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    scroll={false}
                    onClick={() => {
                      setIsOpen(false);
                      setSelectedPath(item.href);
                    }}
                    className={cn(
                      "my-1 flex items-center rounded-lg px-3 py-4 text-sm font-medium transition-colors hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-900 dark:hover:text-blue-100",
                      selectedPath === item.href
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                        : "text-gray-900 dark:text-gray-200",
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* ログアウト確認ダイアログ */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={() => signOut({ callbackUrl: "/" })} className="button-default-custom">
              ログアウト
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
