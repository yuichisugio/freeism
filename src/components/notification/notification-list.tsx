"use client";

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { apiUpdateNotificationStatus, getNotificationsAndUnreadCount } from "@/app/actions/notification";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { AlertCircle, Bell, CheckCircle2, Info, MoreHorizontal, RefreshCw } from "lucide-react";

// 基本的な型定義
type NotificationType = "INFO" | "SUCCESS" | "WARNING";
type FilterType = "all" | "unread" | "read";
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

// Reducerのためのアクション型定義
type NotificationAction =
  | { type: "FETCH_START"; payload?: { append: boolean } }
  | {
      type: "FETCH_SUCCESS";
      payload: { notifications: AppNotification[]; unreadCount: number; hasMore: boolean; append: boolean; currentPage: number };
    }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "SET_FILTER"; payload: FilterType }
  | { type: "SET_SORT"; payload: SortType }
  | { type: "TOGGLE_READ"; payload: { id: string; isRead: boolean } }
  | { type: "MARK_ALL_READ" }
  | { type: "UPDATE_STATUS_SUCCESS" };

// 状態の型定義（大幅シンプル化）
type NotificationState = {
  notifications: AppNotification[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  unreadCount: number;
  activeFilter: FilterType;
  sortBy: SortType;
  currentPage: number;
  hasMore: boolean;
  lastUpdated: number;
};

// 初期状態
const initialState: NotificationState = {
  notifications: [],
  isLoading: true,
  isLoadingMore: false,
  error: null,
  unreadCount: 0,
  activeFilter: "all",
  sortBy: "date",
  currentPage: 1,
  hasMore: true,
  lastUpdated: Date.now(),
};

// モックデータ生成関数（開発用）
const createMockNotifications = (count = 5) => {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: `mock-${i}`,
      type: ["INFO", "SUCCESS", "WARNING"][Math.floor(Math.random() * 3)] as NotificationType,
      title: `テスト通知 ${i + 1}`,
      message: `これはテスト通知のメッセージです。インデックス: ${i}`,
      isRead: i % 2 === 0,
      sentAt: new Date(Date.now() - i * 86400000),
      actionUrl: i % 3 === 0 ? "https://example.com" : null,
      priority: Math.floor(Math.random() * 5) + 1,
    }));
};

// 簡略化したReducer関数
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "FETCH_START":
      return {
        ...state,
        isLoading: !action.payload?.append && !state.isLoadingMore,
        isLoadingMore: !!action.payload?.append,
        error: null,
      };
    case "FETCH_SUCCESS": {
      // デバッグログ
      console.log(`FETCH_SUCCESS: append=${action.payload.append}, 通知数=${action.payload.notifications.length}件`);

      // 更新通知の配列
      let updatedNotifications;

      if (action.payload.append) {
        console.log("追加モードで処理");
        // 既存通知のIDをログ出力
        console.log(
          "既存通知ID:",
          state.notifications.map((n) => n.id),
        );
        // 新規通知のIDをログ出力
        console.log(
          "新規通知ID:",
          action.payload.notifications.map((n) => n.id),
        );

        // 追加モード: 既存の通知に新しい通知を追加
        updatedNotifications = [...state.notifications, ...action.payload.notifications];

        // 重複排除: IDに基づいて一意の通知を保持
        const uniqueMap = new Map();

        // 重要: 後に来た通知を優先するため、逆順でマップに追加
        updatedNotifications
          .slice()
          .reverse()
          .forEach((item) => {
            uniqueMap.set(item.id, item);
          });

        // マップから値を取り出し、最初の順序を保持
        updatedNotifications = Array.from(uniqueMap.values()).reverse();

        console.log(`重複排除後: ${updatedNotifications.length}件`);
      } else {
        console.log("置換モード: 新しい通知で完全に置き換え");
        // 置き換えモード: 新しい通知のみを使用
        updatedNotifications = action.payload.notifications;
      }

      // 新しい状態を返す
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: action.payload.unreadCount,
        hasMore: action.payload.hasMore,
        currentPage: action.payload.currentPage,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        lastUpdated: Date.now(),
      };
    }
    case "FETCH_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isLoadingMore: false,
      };
    case "SET_FILTER":
      return {
        ...state,
        activeFilter: action.payload,
        currentPage: 1,
      };
    case "SET_SORT":
      return {
        ...state,
        sortBy: action.payload,
        currentPage: 1,
      };
    case "TOGGLE_READ": {
      // 既存の通知を更新
      const { id, isRead } = action.payload;
      const updatedNotifications = state.notifications.map((notification) => (notification.id === id ? { ...notification, isRead } : notification));

      // 未読カウントを更新
      const updatedUnreadCount = state.unreadCount + (isRead ? -1 : 1);

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: Math.max(0, updatedUnreadCount),
        lastUpdated: Date.now(),
      };
    }
    case "MARK_ALL_READ": {
      // すべての通知を既読に更新
      const updatedNotifications = state.notifications.map((notification) =>
        notification.isRead ? notification : { ...notification, isRead: true },
      );

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: 0,
        lastUpdated: Date.now(),
      };
    }
    case "UPDATE_STATUS_SUCCESS":
      return {
        ...state,
        lastUpdated: Date.now(),
      };
    default:
      return state;
  }
}

/**
 * 通知アイコンコンポーネント
 */
const NotificationIcon = memo(({ type }: { type: NotificationType }) => {
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
});
NotificationIcon.displayName = "NotificationIcon";

/**
 * 優先度を星で表示するコンポーネント
 */
const PriorityStars = memo(({ priority }: { priority: number }) => {
  const normalizedPriority = Math.min(5, Math.max(1, priority));
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
});
PriorityStars.displayName = "PriorityStars";

/**
 * ローディングインジケーター
 */
const LoadingIndicator = memo(() => <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />);
LoadingIndicator.displayName = "LoadingIndicator";

/**
 * 通知アイテムコンポーネント
 */
const NotificationItem = memo(
  ({ notification, onToggleReadStatus }: { notification: AppNotification; onToggleReadStatus: (id: string, isRead: boolean) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // メッセージの省略表示用
    const truncateMessage = (message: string, maxLength: number = 50) => {
      if (message.length <= maxLength) return message;
      const truncated = message.substring(0, maxLength).replace(/\s\S*$/, "");
      return `${truncated}...`;
    };

    // 通知クリック時のハンドラー
    const handleItemClick = () => setIsExpanded((prev) => !prev);

    // ステータス変更ボタンのハンドラー
    const handleStatusButtonClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isProcessing) return;

      setIsProcessing(true);
      onToggleReadStatus(notification.id, !notification.isRead);

      // 処理完了表示のため少し遅延
      setTimeout(() => setIsProcessing(false), 300);
    };

    return (
      <li
        className={`flex flex-col rounded-lg border transition-colors ${
          notification.isRead ? "bg-background" : "bg-muted/50 dark:bg-blue-950/20"
        } ${isExpanded ? "p-0" : "p-3"}`}
      >
        <div className={`flex cursor-pointer items-start gap-3 ${isExpanded ? "border-b p-3" : ""}`} onClick={handleItemClick}>
          <div className="mt-1">
            <NotificationIcon type={notification.type} />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold">{notification.title}</h4>
                {notification.priority > 0 && <PriorityStars priority={notification.priority} />}
              </div>
              <time className="text-xs text-gray-500" dateTime={notification.sentAt.toISOString()}>
                {formatDistanceToNow(notification.sentAt, { addSuffix: true, locale: ja })}
              </time>
            </div>

            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {isExpanded ? notification.message : truncateMessage(notification.message)}
            </p>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex-1">
                {isExpanded && notification.actionUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (notification.actionUrl) window.open(notification.actionUrl, "_blank");
                    }}
                  >
                    詳細を確認
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-7 bg-gray-100 px-2 text-xs text-gray-500 hover:bg-gray-300"
                disabled={isProcessing}
                onClick={handleStatusButtonClick}
              >
                {isProcessing ? (
                  <>
                    <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                    更新中...
                  </>
                ) : notification.isRead ? (
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

          {notification.isRead ? <span className="invisible mt-1 h-2 w-2" /> : <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
        </div>
      </li>
    );
  },
);
NotificationItem.displayName = "NotificationItem";

/**
 * 通知なしコンポーネント
 */
const NotificationsEmpty = memo(
  ({
    filterType,
    hasMore,
    onLoadMore,
    isLoadingMore,
  }: {
    filterType: FilterType;
    hasMore: boolean;
    onLoadMore: () => void;
    isLoadingMore: boolean;
  }) => (
    <div className="flex h-[300px] flex-col items-center justify-center text-gray-500">
      <p className="mb-4">
        {filterType === "all" ? "通知はありません" : filterType === "unread" ? "未読の通知はありません" : "既読の通知はありません"}
      </p>

      {hasMore && (
        <div className="flex justify-center py-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore} className="w-full text-sm">
            {isLoadingMore ? (
              <>
                <LoadingIndicator />
                読み込み中...
              </>
            ) : (
              <>
                <MoreHorizontal className="mr-1 h-4 w-4" />
                もっと読み込む
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  ),
);
NotificationsEmpty.displayName = "NotificationsEmpty";

/**
 * メインの通知リストコンポーネント
 */
export function NotificationList({ onUnreadStatusChangeAction }: { onUnreadStatusChangeAction?: (hasUnread: boolean) => void }) {
  // 定数
  const ITEMS_PER_PAGE = 10;
  const REFRESH_INTERVAL = 60000; // 1分

  // useReducerで状態管理
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { notifications, isLoading, isLoadingMore, error, unreadCount, activeFilter, sortBy, currentPage, hasMore, lastUpdated } = state;

  // refs
  const isRequestInProgressRef = useRef(false);
  const isMountedRef = useRef(true);

  // 開発環境用にモックデータを使用するかどうか
  const useMockData = process.env.NODE_ENV === "development" && localStorage.getItem("useNotificationMock") === "true";

  // 循環参照を避けるための関数レファレンス
  const loadMoreRef = useRef<() => void>(() => {});

  // API呼び出し関数
  const fetchNotifications = useCallback(
    async (filter = activeFilter, page = 1, sort = sortBy, append = false): Promise<void> => {
      // ログ出力を強化
      console.log(`fetchNotifications 開始: filter=${filter}, page=${page}, sort=${sort}, append=${append}`);

      try {
        // リクエスト進行中フラグを設定（競合防止）
        if (isRequestInProgressRef.current && !append) {
          console.log("別のリクエストが処理中のため、このリクエストはスキップします");
          return;
        }

        isRequestInProgressRef.current = true;

        // ローディング状態を設定
        dispatch({ type: "FETCH_START", payload: { append } });

        // 明示的にページネーションパラメータを計算
        const skip = (page - 1) * ITEMS_PER_PAGE;
        const limit = ITEMS_PER_PAGE + 1; // 1つ余分に取得して次ページ判定用

        console.log(`API呼び出し準備: skip=${skip}, limit=${limit}, currentPage=${currentPage}`);

        // 特別な状況で未読通知を優先的に取得するフラグ
        // 1. 初回ロード時の「すべて」タブ表示
        // 2. 「未読」タブの表示
        const fetchUnreadFirst = (page === 1 && filter === "all") || filter === "unread";

        // APIまたはモックデータからデータ取得
        let result;
        if (useMockData) {
          console.log("モックデータを使用します");
          await new Promise((resolve) => setTimeout(resolve, 500));
          result = {
            notifications: createMockNotifications(limit),
            unreadCount: 3,
          };
        } else {
          // 未読優先フラグを追加して通知を取得
          console.log(`API呼び出し: fetchUnreadFirst=${fetchUnreadFirst}`);
          result = await getNotificationsAndUnreadCount(filter, limit, sort, skip, fetchUnreadFirst);
        }

        // コンポーネントがアンマウントされていたら処理を中止
        if (!isMountedRef.current) {
          console.log("コンポーネントがアンマウントされているため処理中止");
          return;
        }

        // レスポンス検証
        if (!result || !Array.isArray(result.notifications)) {
          console.error("無効なレスポンス:", result);
          throw new Error("APIからの応答が無効です");
        }

        // 結果のログ出力
        console.log(`取得成功: ${result.notifications.length}件, 未読=${result.unreadCount}件`);
        if (result.notifications.length > 0) {
          console.log("最初の通知:", {
            id: result.notifications[0].id,
            title: result.notifications[0].title,
            isRead: result.notifications[0].isRead,
          });
        }

        // 通知が0件の場合の特別処理
        if (result.notifications.length === 0) {
          console.log("取得結果が0件のため、hasMore=falseに設定");

          // フィルターが「未読」または「既読」で結果がない場合の処理
          if (filter !== "all" && page === 1) {
            console.log(`${filter}フィルターで結果がないため通知`);
          }

          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              notifications: [],
              unreadCount: result.unreadCount || 0,
              hasMore: false,
              append: false,
              currentPage: page,
            },
          });

          // 親コンポーネントに未読状態を通知
          if (onUnreadStatusChangeAction) {
            onUnreadStatusChangeAction(result.unreadCount > 0);
          }

          return;
        }

        // 次ページの有無を確認
        const hasMoreNotifications = result.notifications.length > ITEMS_PER_PAGE;

        // 余分に取得した通知を除外
        const fetchedNotifications = hasMoreNotifications ? result.notifications.slice(0, ITEMS_PER_PAGE) : result.notifications;

        // 追加モードの判定（結果がある場合のみ追加モードを有効にする）
        const shouldAppend = append && fetchedNotifications.length > 0;

        console.log(`処理: shouldAppend=${shouldAppend}, hasMore=${hasMoreNotifications}`);

        // 日付文字列をDateオブジェクトに変換
        const processedNotifications = fetchedNotifications.map((notification) => ({
          ...notification,
          sentAt: notification.sentAt instanceof Date ? notification.sentAt : new Date(notification.sentAt),
        }));

        // 状態を更新
        dispatch({
          type: "FETCH_SUCCESS",
          payload: {
            notifications: processedNotifications,
            unreadCount: result.unreadCount || 0,
            hasMore: hasMoreNotifications,
            append: shouldAppend,
            currentPage: page,
          },
        });

        // 親コンポーネントに未読状態を通知
        if (onUnreadStatusChangeAction) {
          onUnreadStatusChangeAction(result.unreadCount > 0);
        }

        // 初回読み込み時に未読通知があり次のページも存在する場合、自動的に読み込み
        if (result.unreadCount > 0 && page === 1 && filter === "all" && hasMoreNotifications) {
          console.log(`未読通知が${result.unreadCount}件あるため、次ページを自動読み込みします`);
          setTimeout(() => {
            if (isMountedRef.current && !isRequestInProgressRef.current) {
              // レファレンス経由で呼び出し
              loadMoreRef.current();
            }
          }, 200);
        }

        // 「すべて」タブ表示時に未読通知がある場合、「未読」タブのデータも先読み
        if (result.unreadCount > 0 && page === 1 && filter === "all") {
          setTimeout(() => {
            // async キーワードを削除
            if (isMountedRef.current && !isRequestInProgressRef.current) {
              console.log("「未読」タブのデータを先読みします");
              const tempInProgress = isRequestInProgressRef.current;
              isRequestInProgressRef.current = true;

              // await を削除し、Promise チェーンを使用
              getNotificationsAndUnreadCount("unread", ITEMS_PER_PAGE, sort, 0, true)
                .then(() => {
                  if (isMountedRef.current) {
                    isRequestInProgressRef.current = tempInProgress;
                  }
                })
                .catch((e) => {
                  console.error("「未読」タブの先読み中にエラー:", e);
                  if (isMountedRef.current) {
                    isRequestInProgressRef.current = tempInProgress;
                  }
                });
            }
          }, 300);
        }
      } catch (err) {
        // エラー処理
        if (!isMountedRef.current) return;

        console.error("通知取得エラー:", err);
        dispatch({
          type: "FETCH_ERROR",
          payload: err instanceof Error ? `通知の取得に失敗しました: ${err.message}` : "通知の取得中にエラーが発生しました",
        });
      } finally {
        // 少し遅延してからフラグをリセット（UI更新との競合防止）
        setTimeout(() => {
          if (isMountedRef.current) {
            isRequestInProgressRef.current = false;
            console.log("リクエスト進行中フラグをリセットしました");
          }
        }, 100);
      }
    },
    [activeFilter, sortBy, onUnreadStatusChangeAction, useMockData, ITEMS_PER_PAGE, currentPage, dispatch],
  );

  // 表示する通知をフィルタリング
  const displayedNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "unread") return !notification.isRead;
      return notification.isRead; // "read" フィルター
    });
  }, [notifications, activeFilter]);

  // 続きのページ読み込み
  // loadMoreNotifications 関数の改良版
  const loadMoreNotifications = useCallback(() => {
    if (isLoadingMore) return;

    // 現在表示されている未読通知の数をカウント
    const displayedUnreadCount = notifications.filter((n) => !n.isRead).length;

    // 表示されている未読数が全体の未読数より少ない場合は、完全リロードを実行
    if (unreadCount > displayedUnreadCount) {
      console.log(`未読通知が完全に表示されていません（表示中: ${displayedUnreadCount}件, 全体: ${unreadCount}件）`);
      console.log("通知を完全リロードします");

      // 一旦フィルターを「すべて」に戻して最初から読み込む（未読表示中の場合も考慮）
      return fetchNotifications("all", 1, sortBy, false);
    }

    // 通常のページネーション処理
    if (!hasMore) return;

    const nextPage = currentPage + 1;
    console.log(`通常のページ読み込み: 次ページ=${nextPage}`);

    // 少し遅延させて状態更新の競合を避ける
    setTimeout(() => {
      if (isMountedRef.current && !isRequestInProgressRef.current) {
        fetchNotifications(activeFilter, nextPage, sortBy, true);
      }
    }, 100);
  }, [activeFilter, currentPage, fetchNotifications, hasMore, isLoadingMore, sortBy, notifications, unreadCount]);

  // 通知リスト表示部分の「もっと読み込む」ボタンの改良版 - JSX部分
  {
    /* もっと読み込むボタン */
  }
  {
    (hasMore || unreadCount > displayedNotifications.filter((n) => !n.isRead).length) && (
      <div className="mt-auto flex justify-center py-2">
        <Button variant="outline" size="sm" onClick={loadMoreNotifications} disabled={isLoadingMore} className="w-full text-sm">
          {isLoadingMore ? (
            <>
              <LoadingIndicator />
              読み込み中...
            </>
          ) : unreadCount > displayedNotifications.filter((n) => !n.isRead).length ? (
            <>
              <RefreshCw className="mr-1 h-4 w-4" />
              すべての通知を読み込む ({unreadCount - displayedNotifications.filter((n) => !n.isRead).length}件の未読を表示)
            </>
          ) : (
            <>
              <MoreHorizontal className="mr-1 h-4 w-4" />
              もっと読み込む
            </>
          )}
        </Button>
      </div>
    );
  }

  // 通知の既読/未読状態の切り替え
  const toggleReadStatus = useCallback(
    (id: string, isRead: boolean) => {
      // ローカル状態を先に更新
      dispatch({ type: "TOGGLE_READ", payload: { id, isRead } });

      // 親コンポーネントにも現在の未読状態を即時通知（最新の状態で）
      const updatedUnreadCount = isRead ? Math.max(0, unreadCount - 1) : unreadCount + 1;

      if (onUnreadStatusChangeAction) {
        onUnreadStatusChangeAction(updatedUnreadCount > 0);
      }

      // void を使用して Promise を直接処理
      void apiUpdateNotificationStatus(id, isRead)
        .then(() => {
          dispatch({ type: "UPDATE_STATUS_SUCCESS" });
        })
        .catch((err) => {
          console.error("通知状態の更新に失敗しました:", err);
        });
    },
    [unreadCount, onUnreadStatusChangeAction],
  );

  // すべての通知を既読にする
  const markAllAsRead = useCallback(async () => {
    // ローカル状態を先に更新
    dispatch({ type: "MARK_ALL_READ" });

    // 親コンポーネントに未読がなくなったことを即時通知
    if (onUnreadStatusChangeAction) {
      onUnreadStatusChangeAction(false);
    }

    try {
      // すべての未読通知を取得して既読に変更
      const unreadNotifications = notifications.filter((n) => !n.isRead);

      // 並行して処理（単純化のため例外ハンドリングは省略）
      await Promise.all(unreadNotifications.map((n) => apiUpdateNotificationStatus(n.id, true)));

      dispatch({ type: "UPDATE_STATUS_SUCCESS" });
    } catch (err) {
      console.error("全通知の既読化に失敗しました:", err);
    }
  }, [notifications, onUnreadStatusChangeAction]);

  // タブ切り替え
  const handleTabChange = useCallback(
    (value: FilterType) => {
      if (value === activeFilter) return;

      dispatch({ type: "SET_FILTER", payload: value });
      fetchNotifications(value, 1, sortBy, false);
    },
    [activeFilter, fetchNotifications, sortBy],
  );

  // ソート変更
  const handleSortChange = useCallback(
    (value: SortType) => {
      if (value === sortBy) return;

      dispatch({ type: "SET_SORT", payload: value });
      fetchNotifications(activeFilter, 1, value, false);
    },
    [activeFilter, fetchNotifications, sortBy],
  );

  const ifFirstMount = useRef(true);
  // 初回マウント時の処理
  useEffect(() => {
    if (ifFirstMount.current) {
      isMountedRef.current = false;
      // 初回データ取得
      const initialFetchTimeout = setTimeout(() => {
        fetchNotifications(activeFilter, 1, sortBy, false);
      }, 100);

      // 定期更新タイマー
      const refreshInterval = setInterval(() => {
        // アクティブなタブの場合のみ自動更新
        if (document.visibilityState === "visible" && !isRequestInProgressRef.current) {
          fetchNotifications(activeFilter, 1, sortBy, false);
        }
      }, REFRESH_INTERVAL);

      return () => {
        isMountedRef.current = false;
        clearTimeout(initialFetchTimeout);
        clearInterval(refreshInterval);
      };
    }
  }, [activeFilter, fetchNotifications, sortBy]); // 初回マウント時のみ実行

  // 表示領域の変更検出（タブが非表示/表示された時）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isRequestInProgressRef.current) {
        fetchNotifications(activeFilter, 1, sortBy, false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeFilter, fetchNotifications, sortBy]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* ヘッダー部分 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800">{unreadCount > 0 ? `${unreadCount}件の未読` : "未読はありません"}</span>
        </div>

        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="bg-gray-100 text-xs text-gray-800 hover:bg-gray-300">
            すべて既読にする
          </Button>
        )}
      </div>

      {/* タブ部分 */}
      <Tabs
        defaultValue="all"
        value={activeFilter}
        onValueChange={(value) => handleTabChange(value as FilterType)}
        className="flex h-full w-full flex-col"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="unread">未読</TabsTrigger>
          <TabsTrigger value="read">既読</TabsTrigger>
        </TabsList>

        {/* ソート選択部分 */}
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

        {/* 通知リスト表示部分 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TabsContent value={activeFilter} className="mt-4 h-full w-full flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex h-[300px] items-center justify-center">
                <div className="text-center">
                  <div className="border-primary mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  <p className="text-sm text-gray-500">通知を読み込み中...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex h-[300px] items-center justify-center">
                <div className="text-center text-red-500">
                  <AlertCircle className="mx-auto mb-2 h-6 w-6" />
                  <p className="text-sm">{error}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchNotifications(activeFilter, 1, sortBy, false)}>
                    再度読み込む
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full max-h-[60vh] pr-4">
                <div className="flex min-h-full flex-col gap-4">
                  {displayedNotifications.length > 0 ? (
                    <>
                      <ul className="space-y-3">
                        {displayedNotifications.map((notification) => (
                          <NotificationItem
                            key={`${notification.id}-${notification.isRead ? "read" : "unread"}-${lastUpdated}`}
                            notification={notification}
                            onToggleReadStatus={toggleReadStatus}
                          />
                        ))}
                      </ul>

                      {/* もっと読み込むボタン */}
                      {hasMore && (
                        <div className="mt-auto flex justify-center py-2">
                          <Button variant="outline" size="sm" onClick={loadMoreNotifications} disabled={isLoadingMore} className="w-full text-sm">
                            {isLoadingMore ? (
                              <>
                                <LoadingIndicator />
                                読み込み中...
                              </>
                            ) : (
                              <>
                                <MoreHorizontal className="mr-1 h-4 w-4" />
                                もっと読み込む
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <NotificationsEmpty
                      filterType={activeFilter}
                      hasMore={hasMore}
                      onLoadMore={loadMoreNotifications}
                      isLoadingMore={isLoadingMore}
                    />
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
