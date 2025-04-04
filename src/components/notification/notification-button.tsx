"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNotificationButton } from "@/hooks/notification/use-notification-button";
import { Bell } from "lucide-react";

import { NotificationList } from "./notification-list";

/**
 * 通知ボタンコンポーネント
 * - レスポンシブ対応: 画面サイズに応じてモーダルのスタイルを変更
 * - クリック時に通知モーダルを表示
 * - 未読通知がある場合はバッジを表示（通知リストと連動）
 */
export function NotificationButton() {
  const { isOpen, setIsOpen, hasUnreadNotifications, handleUnreadStatusChange, status } = useNotificationButton();

  // 未認証の場合は何も表示しない
  if (status === "unauthenticated" || status === "loading") {
    return null;
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="relative" aria-label="通知">
        <Bell className="h-5 w-5" />
        {/* 未読通知がある場合は赤いドットを表示 */}
        {hasUnreadNotifications && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </Button>

      {/* 通知モーダル */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto px-4 sm:max-w-[600px] md:max-w-[75%] lg:max-w-[85%] xl:max-w-[80%]">
          <DialogHeader>
            <DialogTitle>通知</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border px-6 py-2 shadow-sm">
            <NotificationList onUnreadStatusChangeAction={handleUnreadStatusChange} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
