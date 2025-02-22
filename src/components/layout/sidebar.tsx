"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, Menu, PlusCircle, Settings, UserCircle, X } from "lucide-react";
import { signOut } from "next-auth/react";

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
        title: "新規Group作成",
        href: "/dashboard/create-group",
        icon: PlusCircle,
      },
    ],
  },
  {
    title: "My Info",
    items: [
      {
        title: "参加Group一覧",
        href: "/dashboard/my-groups",
        icon: UserCircle,
      },
      {
        title: "Task入力",
        href: "/dashboard/tasks",
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

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function toggleSidebar() {
    setIsOpen(!isOpen);
  }

  return (
    <AlertDialog>
      {/* モバイル用ハンバーガーボタン（sm:hidden） */}
      <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 sm:hidden dark:text-gray-200" onClick={toggleSidebar}>
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* モバイル用オーバーレイ */}
      {isOpen && <div className="fixed top-0 right-0 bottom-0 left-48 z-40 bg-transparent backdrop-blur-sm sm:hidden" onClick={toggleSidebar} />}

      {/* Sidebar本体 */}
      <aside className={cn("sm:static sm:translate-x-0", "fixed top-16 left-0 z-10 h-[calc(100vh-4rem)] w-48 border-r border-blue-100 bg-white transition-transform duration-50 dark:border-blue-900 dark:bg-gray-950", isOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="space-y-4 py-4">
          {sidebarItems.map((section) => (
            <div key={section.title} className="px-3 py-3">
              <h2 className="text-app px-3 text-lg font-semibold tracking-tight dark:text-gray-200">{section.title}</h2>
              {section.items.map((item) =>
                item.isLogout ? (
                  <AlertDialogTrigger key={item.title} asChild>
                    <Link
                      href={item.href}
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
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "my-1 flex items-center rounded-lg px-3 py-4 text-sm font-medium transition-colors hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-900 dark:hover:text-blue-100",
                      pathname === item.href ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-gray-200",
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
}
