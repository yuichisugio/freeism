"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Home,
  List,
  Menu,
  PlusCircle,
  Settings,
  UserCircle,
  X,
} from "lucide-react";

const sidebarItems = [
  {
    title: "Main",
    items: [
      {
        title: "Group一覧",
        href: "/dashboard",
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
    title: "Join Group",
    items: [
      {
        title: "List",
        href: "/dashboard/list",
        icon: List,
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
    title: "review Group",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard/review",
        icon: BarChart3,
      },
      {
        title: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
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
    <>
      {/* モバイル用ハンバーガーボタン（sm:hidden） */}
      <Button
        variant="ghost"
        size="icon"
        className="sticky top-[1.2rem] left-4 z-50 sm:hidden"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          // fixedに変更
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar本体 */}
      <aside
        className={cn(
          // sm以上ではグリッド内で通常表示（幅 16rem）
          "bg-white-500 border-r border-blue-100 backdrop-blur-lg sm:static sm:translate-x-0",
          // sm未満(モバイルでは固定（absolute）でオーバーレイ表示、トランスフォームで出し入れ
          "fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="space-y-4 py-4">
          {sidebarItems.map((section) => (
            <div key={section.title} className="px-3 py-2">
              <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-100 hover:text-blue-900",
                      pathname === item.href
                        ? "bg-blue-100 text-blue-900"
                        : "text-gray-900",
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
