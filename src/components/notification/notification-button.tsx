"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNotificationButton } from "@/hooks/notification/use-notification-button";
import { Bell } from "lucide-react";

import { NotificationList } from "./notification-list";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知ボタンコンポーネント
 * - レスポンシブ対応: 画面サイズに応じてモーダルのスタイルを変更
 * - クリック時に通知モーダルを表示
 * - 未読通知がある場合はバッジを表示（通知リストと連動）
 */
export const NotificationButton = memo(function NotificationButton({ userId }: { userId: string }) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  console.log("src/components/notification/notification-button.tsx_NotificationButton_start_render");

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知ボタンのフック
   */
  const { isOpen, setIsOpen, hasUnreadNotifications } = useNotificationButton(userId);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 通知ボタンのレンダリング
   */
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="relative transition-colors hover:bg-gray-100" aria-label="通知">
        <Bell className="h-5 w-5 text-gray-700" />
        {/* 未読通知がある場合は赤いドットを表示 */}
        {hasUnreadNotifications && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </Button>

      {/* 通知モーダル */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto px-4 sm:max-w-[600px] md:max-w-[75%] lg:max-w-[85%] xl:max-w-[80%]">
          <DialogHeader>
            <DialogTitle className="text-app">通知</DialogTitle>
          </DialogHeader>
          <div className="h-[95vh] rounded-lg border px-6 py-2 shadow-sm">
            <NotificationList />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
