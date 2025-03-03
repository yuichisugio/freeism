"use client";

import type { NotificationFilter, NotificationSortType } from "@/app/actions/notification";
import { useCallback, useEffect, useRef, useState } from "react";
import { getNotificationsAndUnreadCount } from "@/app/actions/notification";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Bell, CheckCircle2, Info, RefreshCw, SortAsc } from "lucide-react";

// 通知タイプの定義
type NotificationType = "INFO" | "SUCCESS" | "WARNING";

// フィルタータイプの定義
type FilterType = "all" | "unread" | "read";

// ソートタイプの定義
type SortType = "date" | "priority" | "type";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  sentAt: Date;
  actionUrl: string | null;
  priority: number;
};

/**
 * 通知アイコンを表示するコンポーネント
 * 通知タイプに応じたアイコンを表示
 */
function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "INFO":
      return <Info className="h-4 w-4 text-blue-500" />;
    case "SUCCESS":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "WARNING":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

/**
 * 優先度を星で表示するコンポーネント
 */
function PriorityStars({ priority }: { priority: number }) {
  // 優先度を1-5の範囲内に制限
  const normalizedPriority = Math.min(5, Math.max(1, priority));

  // 星の数を計算（小数点以下を四捨五入）
  const stars = Math.round(normalizedPriority);

  return (
    <div className="mt-0.5 flex items-center gap-0.5" title={`優先度: ${normalizedPriority}`}>
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`text-xs ${i < stars ? "text-yellow-500" : "text-gray-300"}`}>
          ★
        </span>
      ))}
    </div>
  );
}

// コンポーネント定義ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知リストコンポーネント
 * - フィルタータブで「すべて」「未読」「既読」を切り替え
 * - ソート機能で「日付順」「優先度順」「種類別」に並べ替え
 * - スクロール可能なエリアに通知を表示
 * - 未読/既読状態を管理
 * - 既読状態を未読に戻す機能
 */
export function NotificationList({ onUnreadStatusChangeAction }: { onUnreadStatusChangeAction?: (hasUnread: boolean) => void }) {
  // State定義ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 通知リストの状態
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // ローディング状態
  const [isLoading, setIsLoading] = useState(true);

  // エラー状態
  const [error, setError] = useState<string | null>(null);

  // 未読通知の数
  const [unreadCount, setUnreadCount] = useState(0);

  // 現在選択されているフィルター
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // 現在選択されているソート方法
  const [sortBy, setSortBy] = useState<SortType>("date");

  // 通知の状態変更を一括処理するための状態
  const pendingUpdates = useRef<Map<string, boolean>>(new Map());

  // 定期更新のタイマーID
  const updateTimerId = useRef<NodeJS.Timeout | null>(null);

  // 関数定義ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 親コンポーネントのState関数の定義内容が変わるまでは、画面更新されても同じ関数の定義のまま
  const memoizedGetNotifications = useCallback(
    async function getNotifications(filter: NotificationFilter = "all", limit: number = 200, sort: NotificationSortType = "date") {
      try {
        setIsLoading(true);
        setError(null);

        const notifications = await getNotificationsAndUnreadCount(filter, limit, sort);
        setNotifications(notifications.notifications);
        setUnreadCount(notifications.unreadCount);

        // 未読通知の数が0より大きい場合は、親コンポーネントに通知
        if (onUnreadStatusChangeAction && notifications.unreadCount > 0) {
          onUnreadStatusChangeAction(true);
        }
      } catch (err) {
        console.error("通知取得エラー:", err);
        setError("通知の取得中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    },
    [onUnreadStatusChangeAction],
  );

  // 通知の既読/未読状態を更新する関数
  const memoizedUpdateNotificationStatus = useCallback(
    async function updateNotificationStatus(id: string | null, isRead: boolean) {
      try {
        // すべての通知を更新する場合はnull、それ以外は特定のIDを指定
        await updateNotificationStatus(id, isRead);

        // 更新成功後、現在のフィルターに基づいて通知を再取得
        await memoizedGetNotifications(activeFilter, 200, sortBy);
      } catch (err) {
        console.error("通知更新エラー:", err);
        throw err;
      }
    },
    [activeFilter, memoizedGetNotifications, sortBy],
  );

  // 一括更新処理を行う関数
  const memoizedProcessPendingUpdates = useCallback(
    async function processPendingUpdates() {
      // 保留中の更新がない場合は処理しない
      if (pendingUpdates.current.size === 0) return;

      // 保留中の更新をコピーして、参照をクリア
      const updates = new Map(pendingUpdates.current);
      pendingUpdates.current.clear();

      // 各通知のIDごとに状態更新を行う
      for (const [id, isRead] of updates.entries()) {
        try {
          await memoizedUpdateNotificationStatus(id, isRead);
        } catch (err) {
          console.error(`ID: ${id}の通知更新に失敗しました`, err);
        }
      }
    },
    [memoizedUpdateNotificationStatus],
  );

  // ソート方法が変更されたときの処理
  const handleSortChange = (value: SortType) => {
    setSortBy(value);
    memoizedGetNotifications(activeFilter, 200, sortBy);
  };

  // 通知を既読にする処理
  const memoizedMarkAsRead = useCallback(
    (id: string) => {
      // ローカルの状態を即座に更新（UI応答性を向上）
      setNotifications((current) => current.map((notification) => (notification.id === id ? { ...notification, isRead: true } : notification)));

      // 一括処理用に保留中の更新に追加
      pendingUpdates.current.set(id, true);

      // 未読カウントを更新
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // 親コンポーネントに通知
      if (onUnreadStatusChangeAction && unreadCount <= 1) {
        onUnreadStatusChangeAction(false);
      }
    },
    [unreadCount, onUnreadStatusChangeAction],
  );

  // 通知を未読に戻す処理
  const markAsUnread = useCallback(
    (id: string, event?: React.MouseEvent) => {
      // イベントの伝播を停止（クリックイベントが親要素に伝わるのを防ぐ）
      if (event) {
        event.stopPropagation();
      }

      // ローカルの状態を即座に更新
      setNotifications((current) => current.map((notification) => (notification.id === id ? { ...notification, isRead: false } : notification)));

      // 一括処理用に保留中の更新に追加
      pendingUpdates.current.set(id, false);

      // 未読カウントを更新
      setUnreadCount((prev) => prev + 1);

      // 親コンポーネントに通知
      if (onUnreadStatusChangeAction && unreadCount === 0) {
        onUnreadStatusChangeAction(true);
      }
    },
    [unreadCount, onUnreadStatusChangeAction],
  );

  // すべての通知を既読にする処理
  const markAllAsRead = useCallback(async () => {
    try {
      await memoizedUpdateNotificationStatus(null, true);

      // 未読カウントをリセット
      setUnreadCount(0);

      // 親コンポーネントに通知
      if (onUnreadStatusChangeAction) {
        onUnreadStatusChangeAction(false);
      }
    } catch (err) {
      console.error("全通知の既読化に失敗しました", err);
    }
  }, [memoizedUpdateNotificationStatus, onUnreadStatusChangeAction]);

  // 通知アイテムをクリックした時の処理
  const handleNotificationClick = useCallback(
    (notification: AppNotification) => {
      // 既読にする処理
      if (!notification.isRead) {
        memoizedMarkAsRead(notification.id);
      }

      // 通知にアクションURLがある場合、そのURLに遷移
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
    },
    [memoizedMarkAsRead],
  );

  // useEffect定義ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // コンポーネントのマウント時に通知を取得
  useEffect(() => {
    memoizedGetNotifications(activeFilter, 200, sortBy);

    // 定期的に通知を更新するタイマーをセット（オプション）
    // 例: 1分ごとに更新する場合
    const timerId = setInterval(() => {
      memoizedGetNotifications(activeFilter, 200, sortBy);
    }, 600000); // 600秒 = 10分

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [memoizedGetNotifications, activeFilter, sortBy]);

  // フィルターを変更したときに通知を再取得
  useEffect(() => {
    memoizedGetNotifications(activeFilter, 200, sortBy);
  }, [memoizedGetNotifications, activeFilter, sortBy]);

  // 状態更新を一定間隔で処理するタイマー
  useEffect(() => {
    // コンポーネントのマウント時にタイマーを設定
    updateTimerId.current = setInterval(() => {
      memoizedProcessPendingUpdates();
    }, 3000); // 3秒ごとに一括処理

    return () => {
      // クリーンアップ時にタイマーをクリア
      if (updateTimerId.current) {
        clearInterval(updateTimerId.current);
      }

      // アンマウント時に保留中の更新を処理
      memoizedProcessPendingUpdates();
    };
  }, [memoizedProcessPendingUpdates]);

  // フィルターに基づいて通知をフィルタリング
  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !notification.isRead;
    if (activeFilter === "read") return notification.isRead;
    return true;
  });

  // コンポーネント定義ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex flex-col gap-4">
      {/* 通知のタブ、フィルター内容をstateで管理して、タブ切り替えすると、State関数が実行されて、切り替わる */}
      <Tabs
        defaultValue="unread"
        value={activeFilter}
        onValueChange={(value) => setActiveFilter(value as FilterType)}
        className="w-full sm:max-w-[70%]"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="unread">未読</TabsTrigger>
          <TabsTrigger value="read">既読</TabsTrigger>
        </TabsList>
        {/* ヘッダー部分 - 未読数と全て既読にするボタン */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{unreadCount > 0 ? `${unreadCount}件の未読通知` : "未読通知はありません"}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              すべて既読にする
            </Button>
          )}
        </div>

        {/* フィルターとソートのコントロール */}
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          {/* フィルタータブ */}

          {/* ソート選択 */}
          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-gray-500" />
            <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortType)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="ソート方法" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">日付順</SelectItem>
                <SelectItem value="priority">優先度順</SelectItem>
                <SelectItem value="type">種類別</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 通知リスト */}
        <TabsContent value={activeFilter}>
          {/* ローディング状態の表示 */}
          {isLoading ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="text-center">
                <div className="border-primary mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                <p className="text-sm text-gray-500">通知を読み込み中...</p>
              </div>
            </div>
          ) : error ? (
            // エラー状態の表示
            <div className="flex h-[300px] items-center justify-center">
              <div className="text-center text-red-500">
                <AlertCircle className="mx-auto mb-2 h-6 w-6" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : (
            // 通知リスト
            <ScrollArea className={cn("h-[300px] pr-4")}>
              {filteredNotifications.length > 0 ? (
                <ul className="space-y-3">
                  {filteredNotifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        notification.isRead ? "bg-background" : "bg-muted/50 dark:bg-blue-950/20"
                      } ${notification.actionUrl ? "hover:bg-muted/70 cursor-pointer" : ""}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* 通知アイコン */}
                      <div className="mt-1">
                        <NotificationIcon type={notification.type} />
                      </div>

                      {/* 通知内容 */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold">{notification.title}</h4>
                            {notification.priority && <PriorityStars priority={notification.priority} />}
                          </div>
                          <time className="text-xs text-gray-500" dateTime={notification.sentAt.toISOString()}>
                            {formatDistanceToNow(notification.sentAt, {
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
