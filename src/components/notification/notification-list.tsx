"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Bell, CheckCircle2, Info, RefreshCw } from "lucide-react";

// 通知タイプの定義
type NotificationType = "info" | "success" | "warning";

// フィルタータイプの定義
type FilterType = "all" | "unread" | "read";

// 通知アイテムの型定義
type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  date: Date;
  isRead: boolean;
};

// モック通知データ
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "info",
    title: "新機能追加",
    message: "ダッシュボードに新しい機能が追加されました。確認してみましょう！",
    date: new Date(Date.now() - 1000 * 60 * 30), // 30分前
    isRead: false,
  },
  {
    id: "2",
    type: "success",
    title: "登録完了",
    message: "グループへの登録が完了しました。",
    date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2時間前
    isRead: false,
  },
  {
    id: "3",
    type: "warning",
    title: "タスク期限",
    message: "明日までのタスクがあります。忘れずに完了させましょう。",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1日前
    isRead: true,
  },
  {
    id: "4",
    type: "info",
    title: "メンテナンス情報",
    message: "明日午前2時から4時までメンテナンスを実施します。",
    date: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2日前
    isRead: true,
  },
];

/**
 * 通知アイコンを表示するコンポーネント
 * 通知タイプに応じたアイコンを表示
 */
function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

/**
 * 通知リストコンポーネント
 * - フィルタータブで「すべて」「未読」「既読」を切り替え
 * - スクロール可能なエリアに通知を表示
 * - 未読/既読状態を管理
 * - 既読状態を未読に戻す機能
 */
export function NotificationList({
  fullPage = false,
  onUnreadStatusChange,
}: {
  fullPage?: boolean;
  onUnreadStatusChange?: (hasUnread: boolean) => void;
}) {
  // 通知リストの状態を管理（実際の実装ではAPIからデータを取得）
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  // 現在選択されているフィルター
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // 通知を既読にする処理
  const markAsRead = (id: string) => {
    setNotifications(notifications.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)));
  };

  // 通知を未読に戻す処理
  const markAsUnread = (id: string, event?: React.MouseEvent) => {
    // イベントの伝播を停止（クリックイベントが親要素に伝わるのを防ぐ）
    if (event) {
      event.stopPropagation();
    }

    setNotifications(notifications.map((notification) => (notification.id === id ? { ...notification, isRead: false } : notification)));
  };

  // すべての通知を既読にする処理
  const markAllAsRead = () => {
    setNotifications(notifications.map((notification) => ({ ...notification, isRead: true })));
  };

  // 未読通知の数を計算
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  // 通知の既読状態が変わるたびに親コンポーネントに通知
  useEffect(() => {
    if (onUnreadStatusChange) {
      onUnreadStatusChange(unreadCount > 0);
    }
  }, [unreadCount, onUnreadStatusChange]);

  // フィルターに基づいて通知をフィルタリング
  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.isRead;
    if (activeFilter === "read") return notification.isRead;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* ヘッダー部分 - 未読数と全て既読にするボタン */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount}件の未読通知` : "未読通知はありません"}</span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
            すべて既読にする
          </Button>
        )}
      </div>

      {/* フィルタータブ */}
      <Tabs defaultValue="all" value={activeFilter} onValueChange={(value) => setActiveFilter(value as FilterType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="unread">未読</TabsTrigger>
          <TabsTrigger value="read">既読</TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter}>
          {/* 通知リスト */}
          <ScrollArea className={cn(fullPage ? "h-[calc(100vh-250px)]" : "h-[300px]", "pr-4")}>
            {filteredNotifications.length > 0 ? (
              <ul className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      notification.isRead ? "bg-background" : "bg-muted/50 dark:bg-blue-950/20"
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {/* 通知アイコン */}
                    <div className="mt-1">
                      <NotificationIcon type={notification.type} />
                    </div>

                    {/* 通知内容 */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold">{notification.title}</h4>
                        <time className="text-xs text-gray-500" dateTime={notification.date.toISOString()}>
                          {formatDistanceToNow(notification.date, {
                            addSuffix: true,
                            locale: ja,
                          })}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>

                      {/* 未読/既読切り替えボタン */}
                      <div className="mt-2 flex justify-end">
                        {notification.isRead ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-500"
                            onClick={(e) => markAsUnread(notification.id, e)}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            未読にする
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* 未読バッジ */}
                    {!notification.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                {activeFilter === "all" ? "通知はありません" : activeFilter === "unread" ? "未読の通知はありません" : "既読の通知はありません"}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
