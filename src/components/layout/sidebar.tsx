"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, Menu, PlusCircle, Settings, UserCircle, X } from "lucide-react";

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
        href: "/dashboard/logout",
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
        // top-[1.2rem]は、位置を上から1.2remに設定。left-4は左からのマージンがTailwindのspacingスケールの4（1remや16pxに相当）分確保されます。z-index を 50 に設定し、他の要素よりも前面に表示
        className="fixed top-4 left-4 z-50 sm:hidden"
        onClick={toggleSidebar}
      >
        {/* ハンバーガーボタンのアイコンを表示 */}
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* モバイル用オーバーレイ */}
      {isOpen && (
        <div
          // fixedに変更。inset-0で、上・右・下・左すべてを 0 に設定し、画面全体を覆うようにします。
          className="fixed top-0 right-0 bottom-0 left-48 z-40 bg-transparent backdrop-blur-sm sm:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar本体 */}
      {/* asideタグは、HTML標準のタグで、divと同じ動きをするが、サイドバーを表す分かりやすいタグ名として提供されている*/}
      <aside
        // cn()で、classNameを統合する。引数の後ろにあるほど上書きする
        className={cn(
          // sm以上では通常表示（幅16rem）。staticで固定するので、メインContentにシークバーがある場合は固定されないので注意。translate-x-0でtranslate-x-fullをリセット
          "sm:static sm:translate-x-0",
          // sm未満(モバイル端末)fixedでメニュー表示
          "fixed top-16 left-0 z-10 h-[calc(100vh-4rem)] w-48 border-r border-blue-100 bg-white transition-transform duration-50",
          // sm未満のメニュー表示時はtranslate-x-0で表示、非表示時はtranslate-x-fullを横方向にマイナスにして画面外に出すことで、メニューが非表示の場合にメニューの領域を確保しないようにする。
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* メニュー表示 */}
        {/* 各セクションを上下でmarginとPaddingを入れている */}
        <div className="space-y-4 py-4">
          {sidebarItems.map((section) => (
            <div key={section.title} className="px-3 py-3">
              {/* セクションのタイトル */}
              {/* 文字間隔を狭く設定し、まとまりのある印象を与えます */}
              <h2 className="px-3 text-lg font-semibold tracking-tight">
                {section.title}
              </h2>
              {/* セクションのメニュー */}
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setIsOpen(false);
                  }}
                  className={cn(
                    "my-1 flex items-center rounded-lg px-3 py-4 text-sm font-medium transition-colors hover:bg-blue-100 hover:text-blue-900",
                    // 現在の表示されている画面のURL PATH（pathname）は、ホバー時の色と同じ表示を常時行う設定。リンク先（item.href）と一致する場合は、ホバー時の色と同じ表示を常時行う設定。
                    pathname === item.href
                      ? "bg-blue-100 text-blue-900"
                      : "text-gray-900",
                  )}
                >
                  {/* アイコンを表示 */}
                  <item.icon className="mr-2 h-4 w-4" />
                  {/* メニューのタイトル */}
                  {item.title}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
