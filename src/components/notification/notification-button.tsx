"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/notification-dialog";
import { useNotificationButton } from "@/hooks/notification/use-notification-button";
import { useShortcut } from "@/hooks/utils/use-shortcut";
import { Bell } from "lucide-react";

import { NotificationList } from "./notification-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタンコンポーネント
 * - レスポンシブ対応: 画面サイズに応じてモーダルのスタイルを変更
 * - クリック時に通知モーダルを表示
 * - 未読通知がある場合はバッジを表示（通知リストと連動）
 */
export const NotificationButton = memo(function NotificationButton() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/notification/notification-button.tsx_NotificationButton_start_render");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知ボタンのフック
   */
  const { isOpen, setIsOpen, hasUnreadNotifications } = useNotificationButton();

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * ショートカットキーの設定
   * n+alt+ctrlで通知モーダーを開く
   */
  useShortcut([
    {
      code: "KeyN",
      alt: true,
      callback: () => setIsOpen(true),
      preventDefault: true,
    },
  ]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知ボタンのレンダリング
   */
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative h-9 w-9 rounded-full transition-all duration-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-0 dark:hover:bg-gray-800"
        aria-label="通知"
      >
        <Bell className="h-[18px] w-[18px] text-gray-700 focus:outline-none focus-visible:ring-0 dark:text-gray-300" />
        {/* 未読通知がある場合は赤いドットを表示 */}
        {hasUnreadNotifications && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white focus:outline-none focus-visible:ring-0 dark:ring-gray-900" />
        )}
      </Button>

      {/* 通知モーダル */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="grid h-[95vh] grid-rows-[auto_1fr] overflow-hidden bg-gray-50 px-4 focus:outline-none focus-visible:ring-0 sm:max-w-[600px] md:max-w-[75%] lg:max-w-[85%] xl:max-w-[90%] dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="mb-4 flex text-lg font-semibold text-gray-800 dark:text-gray-200">
              <Bell className="mt-1 mr-4 ml-8 h-5 w-5" />
              通知
            </DialogTitle>
          </DialogHeader>
          <NotificationList />
        </DialogContent>
      </Dialog>
    </>
  );
});
