"use client";

import type { NotificationFilter, NotificationSortType } from "@/app/actions/notification";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiUpdateNotificationStatus, getNotificationsAndUnreadCount } from "@/app/actions/notification";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Bell, CheckCircle2, Info, RefreshCw } from "lucide-react";

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
    async function updateNotificationsStatus(id: string | null, isRead: boolean) {
      try {
        // すべての通知を更新する場合はnull、それ以外は特定のIDを指定
        await apiUpdateNotificationStatus(id, isRead);

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

  // useEffect定義ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 初回マウント時のみ実行。引数に参照値の更新後も更新するよう入れないと警告が出るけど、初回のみにしたいため。
  const isFirstRenderForMemoizedGetNotifications = useRef(true);

  useEffect(() => {
    if (isFirstRenderForMemoizedGetNotifications.current) {
      console.log("初回マウント時のみ実行");

      // 初回実行時の処理
      memoizedGetNotifications(activeFilter, 200, sortBy);

      // 定期更新の設定。600秒 = 10分
      const timerId = setInterval(() => {
        memoizedGetNotifications(activeFilter, 200, sortBy);
      }, 600000);

      isFirstRenderForMemoizedGetNotifications.current = false;

      return () => {
        if (timerId) clearInterval(timerId);
      };
    }
  }, [memoizedGetNotifications, activeFilter, sortBy]);

  // フィルターを変更したときに通知を再取得
  useEffect(() => {
    memoizedGetNotifications(activeFilter, 200, sortBy);
  }, [memoizedGetNotifications, activeFilter, sortBy]);

  const isFirstRenderForMemoizedProcessPendingUpdates = useRef(true);
  // 状態更新を一定間隔で処理するタイマー
  useEffect(() => {
    if (isFirstRenderForMemoizedProcessPendingUpdates.current) {
      // コンポーネントのマウント時にタイマーを設定
      updateTimerId.current = setInterval(() => {
        memoizedProcessPendingUpdates();
      }, 300000); // 30秒ごとに一括処理

      return () => {
        // クリーンアップ時にタイマーをクリア
        if (updateTimerId.current) {
          clearInterval(updateTimerId.current);
        }

        // アンマウント時に保留中の更新を処理
        memoizedProcessPendingUpdates();
      };
    }
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
      {/* ヘッダー部分 - 未読数と全て既読にするボタン */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-800">{unreadCount > 0 ? `${unreadCount}件の未読` : "未読はありません"}</span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="bg-gray-100 text-xs text-gray-800 hover:bg-gray-300">
            すべて既読にする
          </Button>
        )}
      </div>

      {/* 通知のタブ、フィルター内容をstateで管理して、タブ切り替えすると、State関数が実行されて、切り替わる */}
      <Tabs defaultValue="all" value={activeFilter} onValueChange={(value) => setActiveFilter(value as FilterType)} className="w-full">
        {/* タブの表示 */}
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="unread">未読</TabsTrigger>
          <TabsTrigger value="read">既読</TabsTrigger>
        </TabsList>

        {/* ソート選択 */}
        <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortType)}>
          <SelectTrigger className="my-2 h-9 w-[140px]">
            <SelectValue placeholder="ソート方法" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">日付順</SelectItem>
            <SelectItem value="priority">優先度順</SelectItem>
            <SelectItem value="type">種類別</SelectItem>
          </SelectContent>
        </Select>

        {/* 通知リスト */}
        <TabsContent value={activeFilter} className="mt-4 w-full">
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
            <ScrollArea className={cn("pr-4")}>
              {filteredNotifications.length > 0 ? (
                <ul className="space-y-3">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      memoizedMarkAsRead={memoizedMarkAsRead}
                      markAsUnread={markAsUnread}
                    />
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

function NotificationItem({
  notification,
  memoizedMarkAsRead,
  markAsUnread,
}: {
  notification: AppNotification;
  memoizedMarkAsRead: (id: string) => void;
  markAsUnread: (id: string, event?: React.MouseEvent) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // メッセージを省略するための関数
  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;

    // 最大長さまでのテキストを取得し、単語の途中で切れないように調整
    const truncated = message.substring(0, maxLength).replace(/\s\S*$/, "");
    return `${truncated}...`;
  };

  return (
    <li
      className={`flex flex-col rounded-lg border transition-colors ${notification.isRead ? "bg-background" : "bg-muted/50 dark:bg-blue-950/20"} ${isExpanded ? "p-0" : "p-3"}`}
    >
      {/* 通知ヘッダー部分 - クリックで展開/折りたたみ */}
      <div
        className={`flex cursor-pointer items-start gap-3 ${isExpanded ? "p-3" : ""}`}
        onClick={() => {
          if (!notification.isRead) {
            memoizedMarkAsRead(notification.id);
          }
          setIsExpanded(!isExpanded);
        }}
      >
        {/* 通知タイプのアイコン */}
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

          {/* メッセージ表示 - 展開時は全文、折りたたみ時は省略表示 */}
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{isExpanded ? notification.message : truncateMessage(notification.message)}</p>

          {/* 操作ボタン - 展開時も折りたたみ時も同じ位置に配置 */}
          <div className="mt-2 flex items-center justify-between">
            {/* 詳細ボタン用のコンテナ - 常に同じ幅を確保 */}
            <div className="flex-1">
              {isExpanded && notification.actionUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (notification.actionUrl) {
                      window.open(notification.actionUrl, "_blank");
                    }
                  }}
                >
                  詳細を確認
                </Button>
              )}
            </div>

            {/* 未読/既読切り替えボタン - 右寄せで固定位置 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 bg-gray-100 px-2 text-xs text-gray-500 hover:bg-gray-300"
              onClick={(e) => {
                e.stopPropagation();
                notification.isRead ? markAsUnread(notification.id, e) : memoizedMarkAsRead(notification.id);
              }}
            >
              {notification.isRead ? (
                <>
                  <RefreshCw className="mr-1 h-3 w-3" />
                  未読にする
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  既読にする
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 未読バッジ */}
        {notification.isRead ? <span className="invisible mt-1 h-2 w-2" /> : <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
      </div>
    </li>
  );
}
