"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell } from "lucide-react";

import { NotificationList } from "./notification-list";

/**
 * 通知ボタンコンポーネント
 * - レスポンシブ対応: 画面サイズに応じてモーダルのスタイルを変更
 * - クリック時に通知モーダルを表示
 * - 未読通知がある場合はバッジを表示（通知リストと連動）
 */
export function NotificationButton() {
  // モーダルの開閉状態を管理
  const [isOpen, setIsOpen] = useState(false);

  // 画面幅を監視するためのstate
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // 未読通知があるかどうかの状態
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  // 画面サイズの変更を監視
  useEffect(() => {
    // 初期値を設定
    setIsSmallScreen(window.innerWidth < 640);

    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 未読通知の状態が変更されたときのハンドラー
  const handleUnreadStatusChange = (hasUnread: boolean) => {
    setHasUnreadNotifications(hasUnread);
  };

  // レスポンシブに対応したモーダルのスタイル
  const modalStyle = isSmallScreen
    ? "h-[80vh] sm:max-w-md" // モバイル向け（高さを制限）
    : "sm:max-w-md"; // デスクトップ向け

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="relative" aria-label="通知">
        <Bell className="h-5 w-5" />
        {/* 未読通知がある場合は赤いドットを表示 */}
        {hasUnreadNotifications && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
      </Button>

      {/* 通知モーダル */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className={modalStyle}>
          <DialogHeader>
            <DialogTitle>通知</DialogTitle>
          </DialogHeader>
          <NotificationList onUnreadStatusChange={handleUnreadStatusChange} />
        </DialogContent>
      </Dialog>
    </>
  );
}
