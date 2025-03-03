"use client";

import type { NotificationFilter, NotificationSortType } from "@/app/actions/notification";
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

// 保留中の状態変更を追跡するための型
type PendingStatusChange = {
  id: string;
  isRead: boolean;
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
  | { type: "TOGGLE_READ_LOCAL"; payload: { id: string; isRead: boolean } }
  | { type: "TOGGLE_READ_START" }
  | { type: "TOGGLE_READ_SUCCESS" }
  | { type: "TOGGLE_READ_ERROR" }
  | { type: "MARK_ALL_READ_LOCAL" }
  | { type: "MARK_ALL_READ_START" }
  | { type: "MARK_ALL_READ_SUCCESS" }
  | { type: "MARK_ALL_READ_ERROR" }
  | { type: "COMMIT_PENDING_CHANGES_START" }
  | { type: "COMMIT_PENDING_CHANGES_SUCCESS" }
  | { type: "COMMIT_PENDING_CHANGES_ERROR" }
  | { type: "CLEAR_PENDING_CHANGES" };

// 状態の型定義
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
  isProcessingAllRead: boolean;
  isProcessingToggleRead: boolean;
  isCommittingChanges: boolean;
  lastUpdated: number; // 最後の更新タイムスタンプ
  pendingStatusChanges: PendingStatusChange[]; // 保留中の既読/未読変更
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
  isProcessingAllRead: false,
  isProcessingToggleRead: false,
  isCommittingChanges: false,
  lastUpdated: Date.now(),
  pendingStatusChanges: [],
};

// Reducer関数
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case "FETCH_START":
      return {
        ...state,
        isLoading: !action.payload?.append && !state.isLoadingMore,
        isLoadingMore: !!action.payload?.append,
        error: null,
      };
    case "FETCH_SUCCESS":
      return {
        ...state,
        notifications: action.payload.append ? [...state.notifications, ...action.payload.notifications] : action.payload.notifications,
        unreadCount: action.payload.unreadCount,
        hasMore: action.payload.hasMore,
        currentPage: action.payload.currentPage,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        lastUpdated: Date.now(),
        // 新しいデータが取得されたらpendingChangesはクリア
        pendingStatusChanges: [],
      };
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
    case "TOGGLE_READ_LOCAL": {
      // ローカルステートのみを更新して、変更をpendingStatusChangesに追加
      const { id, isRead } = action.payload;

      // 既存の通知を更新
      const updatedNotifications = state.notifications.map((notification) => (notification.id === id ? { ...notification, isRead } : notification));

      // 未読カウントを更新
      const updatedUnreadCount = state.unreadCount + (isRead ? -1 : 1);

      // 既存の保留中の変更から同じIDのものを除外し、新しい変更を追加
      const existingChangeIndex = state.pendingStatusChanges.findIndex((change) => change.id === id);
      let updatedPendingChanges = [...state.pendingStatusChanges];

      if (existingChangeIndex >= 0) {
        // 既に同じIDの変更がある場合は置き換え
        updatedPendingChanges[existingChangeIndex] = { id, isRead };
      } else {
        // 新しい変更を追加
        updatedPendingChanges.push({ id, isRead });
      }

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: Math.max(0, updatedUnreadCount), // 負の値にならないよう保証
        pendingStatusChanges: updatedPendingChanges,
        lastUpdated: Date.now(),
      };
    }
    case "TOGGLE_READ_START":
      return {
        ...state,
        isProcessingToggleRead: true,
      };
    case "TOGGLE_READ_SUCCESS":
      return {
        ...state,
        isProcessingToggleRead: false,
      };
    case "TOGGLE_READ_ERROR":
      return {
        ...state,
        isProcessingToggleRead: false,
      };
    case "MARK_ALL_READ_LOCAL": {
      // 未読通知をすべて既読にする（ローカル状態のみ）
      const unreadNotifications = state.notifications.filter((n) => !n.isRead);

      // すべての通知を既読に更新
      const updatedNotifications = state.notifications.map((notification) =>
        !notification.isRead ? { ...notification, isRead: true } : notification,
      );

      // 変更をpendingChangesに追加
      const newPendingChanges = unreadNotifications.map((n) => ({ id: n.id, isRead: true }));

      // 既存の保留中の変更から重複するIDを除外し、新しい変更を追加
      const existingIds = new Set(state.pendingStatusChanges.map((change) => change.id));
      const filteredNewChanges = newPendingChanges.filter((change) => !existingIds.has(change.id));

      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: 0,
        pendingStatusChanges: [...state.pendingStatusChanges, ...filteredNewChanges],
        lastUpdated: Date.now(),
      };
    }
    case "MARK_ALL_READ_START":
      return {
        ...state,
        isProcessingAllRead: true,
      };
    case "MARK_ALL_READ_SUCCESS":
      return {
        ...state,
        isProcessingAllRead: false,
      };
    case "MARK_ALL_READ_ERROR":
      return {
        ...state,
        isProcessingAllRead: false,
      };
    case "COMMIT_PENDING_CHANGES_START":
      return {
        ...state,
        isCommittingChanges: true,
      };
    case "COMMIT_PENDING_CHANGES_SUCCESS":
      return {
        ...state,
        isCommittingChanges: false,
        pendingStatusChanges: [], // 変更がコミットされたらクリア
      };
    case "COMMIT_PENDING_CHANGES_ERROR":
      return {
        ...state,
        isCommittingChanges: false,
        // エラー時はpendingChangesを保持して再試行できるようにする
      };
    case "CLEAR_PENDING_CHANGES":
      return {
        ...state,
        pendingStatusChanges: [],
      };
    default:
      return state;
  }
}

/**
 * 通知アイコンを表示するコンポーネント
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
 * 通知アイテムコンポーネント
 */
const NotificationItem = memo(
  ({
    notification,
    onToggleReadStatus,
    isProcessingToggleRead,
  }: {
    notification: AppNotification;
    onToggleReadStatus: (id: string, isRead: boolean) => void;
    isProcessingToggleRead: boolean;
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const truncateMessage = useMemo(() => {
      return (message: string, maxLength: number = 50) => {
        if (message.length <= maxLength) return message;
        const truncated = message.substring(0, maxLength).replace(/\s\S*$/, "");
        return `${truncated}...`;
      };
    }, []);

    // 通知クリック時のハンドラー - 展開/折りたたみのみ行う
    const handleItemClick = useCallback(() => {
      // 展開状態を切り替え
      setIsExpanded((prev) => !prev);
    }, []);

    // ステータス変更ボタンのハンドラー
    const handleStatusButtonClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isProcessing || isProcessingToggleRead) return;

        // ローカル処理状態を更新
        setIsProcessing(true);

        // 現在の状態と逆の状態に変更（ローカルのみ）
        onToggleReadStatus(notification.id, !notification.isRead);

        // 短い遅延後に処理中表示を解除
        setTimeout(() => {
          setIsProcessing(false);
        }, 300);
      },
      [isProcessing, isProcessingToggleRead, notification.id, notification.isRead, onToggleReadStatus],
    );

    return (
      <li
        className={`flex flex-col rounded-lg border transition-colors ${notification.isRead ? "bg-background" : "bg-muted/50 dark:bg-blue-950/20"} ${isExpanded ? "p-0" : "p-3"}`}
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
                {formatDistanceToNow(notification.sentAt, {
                  addSuffix: true,
                  locale: ja,
                })}
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
                      if (notification.actionUrl) {
                        window.open(notification.actionUrl, "_blank");
                      }
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
                disabled={isProcessing || isProcessingToggleRead}
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

// 再利用可能なローディングインジケーター
const LoadingIndicator = memo(() => <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />);
LoadingIndicator.displayName = "LoadingIndicator";

// 通知なしコンポーネント
const NotificationsEmpty = memo(
  ({
    filterType,
    hasMore,
    onLoadMore,
    isLoadingMore,
    isProcessingAllRead,
    isCommittingChanges,
  }: {
    filterType: FilterType;
    hasMore: boolean;
    onLoadMore: () => void;
    isLoadingMore: boolean;
    isProcessingAllRead: boolean;
    isCommittingChanges: boolean;
  }) => (
    <div className="flex h-[300px] flex-col items-center justify-center text-gray-500">
      <p className="mb-4">
        {filterType === "all" ? "通知はありません" : filterType === "unread" ? "未読の通知はありません" : "既読の通知はありません"}
      </p>

      {/* 修正: 通知が無くてもhasMoreがtrueならボタンを表示 */}
      {hasMore && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore || isProcessingAllRead || isCommittingChanges}
            className="w-full text-sm"
          >
            {isLoadingMore || isCommittingChanges ? (
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
  const MAX_CONCURRENT_REQUESTS = 5; // 一度に処理するリクエストの最大数
  const BATCH_COMMIT_DELAY = 300; // バッチコミット前の遅延（ms）

  // 初期化完了フラグ
  const isInitializedRef = useRef(false);
  // APIリクエスト中かどうかを追跡
  const isRequestInProgressRef = useRef(false);
  // マウント状態を追跡
  const isMountedRef = useRef(true);
  // 最後のコミット時間を記録
  const lastCommitTimeRef = useRef(0);
  // コミットタイマー
  const commitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // useReducerで状態管理
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const {
    notifications,
    isLoading,
    isLoadingMore,
    error,
    unreadCount,
    activeFilter,
    sortBy,
    currentPage,
    hasMore,
    isProcessingAllRead,
    isProcessingToggleRead,
    isCommittingChanges,
    pendingStatusChanges,
    lastUpdated,
  } = state;

  // 保留中の変更をコミット（DBに反映）する関数
  const commitPendingChanges = useCallback(async () => {
    if (pendingStatusChanges.length === 0 || isCommittingChanges) return;

    try {
      dispatch({ type: "COMMIT_PENDING_CHANGES_START" });

      // タイマーをクリア
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }

      // 現在のpendingStatusChangesのコピーを作成
      // これにより、処理中に新しい変更が追加されても、今回のバッチには含まれない
      const changestoCommit = [...pendingStatusChanges];

      // 保留中の変更をバッチに分けて処理
      const batches: PendingStatusChange[][] = [];
      for (let i = 0; i < changestoCommit.length; i += MAX_CONCURRENT_REQUESTS) {
        batches.push(changestoCommit.slice(i, i + MAX_CONCURRENT_REQUESTS));
      }

      // 各バッチの結果を追跡
      const results = [];

      // 各バッチを順番に処理
      for (const batch of batches) {
        const batchResults = await Promise.allSettled(batch.map((change) => apiUpdateNotificationStatus(change.id, change.isRead)));

        results.push(...batchResults);
      }

      // エラーをチェック
      const errors = results.filter((r) => r.status === "rejected");
      if (errors.length > 0) {
        console.warn(`${errors.length}件の変更が適用できませんでした`);
        // エラーのあった変更はpendingStatusChangesに残す処理も可能だが、
        // 単純化のため今回は実装しない
      }

      // 最後のコミット時間を更新
      lastCommitTimeRef.current = Date.now();

      // コミット成功
      dispatch({ type: "COMMIT_PENDING_CHANGES_SUCCESS" });

      // サーバー側の処理完了を少し待つ
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error("通知状態の一括更新に失敗しました", error);
      dispatch({ type: "COMMIT_PENDING_CHANGES_ERROR" });
    }
  }, [pendingStatusChanges, isCommittingChanges]);

  // APIから通知を取得する関数
  const fetchNotifications = useCallback(
    async (filter: NotificationFilter = activeFilter, page: number = 1, sort: NotificationSortType = sortBy, append: boolean = false) => {
      // すでにリクエスト中であれば、重複実行しない
      if (isRequestInProgressRef.current) {
        return;
      }

      try {
        isRequestInProgressRef.current = true;

        // コミット中の変更があれば、先にコミット
        if (pendingStatusChanges.length > 0 && !isCommittingChanges) {
          await commitPendingChanges();
        }

        // ローディング状態の設定
        dispatch({ type: "FETCH_START", payload: { append } });

        // APIからデータ取得
        const skip = (page - 1) * ITEMS_PER_PAGE;
        const limit = ITEMS_PER_PAGE + 1; // 1つ余分に取得して次ページ判定

        const result = await getNotificationsAndUnreadCount(filter, limit, sort, skip);

        // コンポーネントがアンマウントされていたら処理を中止
        if (!isMountedRef.current) return;

        // 次ページの有無確認
        const hasMoreNotifications = result.notifications.length > ITEMS_PER_PAGE;

        // 余分に取得した通知を除外
        const fetchedNotifications = hasMoreNotifications ? result.notifications.slice(0, ITEMS_PER_PAGE) : result.notifications;

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
            unreadCount: result.unreadCount,
            hasMore: hasMoreNotifications,
            append,
            currentPage: page,
          },
        });

        // 親コンポーネントに未読ステータスを通知
        if (onUnreadStatusChangeAction) {
          onUnreadStatusChangeAction(result.unreadCount > 0);
        }

        // 初期化完了を設定
        isInitializedRef.current = true;
      } catch (err) {
        // コンポーネントがアンマウントされていたら処理を中止
        if (!isMountedRef.current) return;

        console.error("通知取得エラー:", err);
        dispatch({ type: "FETCH_ERROR", payload: "通知の取得中にエラーが発生しました" });
      } finally {
        isRequestInProgressRef.current = false;
      }
    },
    [activeFilter, sortBy, onUnreadStatusChangeAction, commitPendingChanges, pendingStatusChanges, isCommittingChanges],
  );

  // 遅延コミットをスケジュール
  const scheduleCommit = useCallback(() => {
    // 既存のタイマーをクリア
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }

    // 新しいタイマーをセット
    commitTimerRef.current = setTimeout(() => {
      if (pendingStatusChanges.length > 0) {
        commitPendingChanges();
      }
    }, BATCH_COMMIT_DELAY);
  }, [pendingStatusChanges.length, commitPendingChanges]);

  // 通知の既読/未読状態を切り替える関数（ローカルのみ）
  const toggleReadStatusLocal = useCallback(
    (id: string, isRead: boolean) => {
      // ローカル状態のみを更新
      dispatch({ type: "TOGGLE_READ_LOCAL", payload: { id, isRead } });

      // 遅延コミットをスケジュール
      scheduleCommit();
    },
    [scheduleCommit],
  );

  // すべての通知を既読にするロジック（ローカルのみ）
  const handleMarkAllAsReadLocal = useCallback(() => {
    if (isProcessingAllRead) return;

    // ローカル状態ですべての通知を既読に
    dispatch({ type: "MARK_ALL_READ_LOCAL" });

    // 遅延コミットをスケジュール
    scheduleCommit();
  }, [isProcessingAllRead, scheduleCommit]);

  // 次のページを読み込む
  const loadMoreNotifications = useCallback(async () => {
    if (isLoadingMore || isRequestInProgressRef.current) return;

    // 保留中の変更があれば先にコミット
    if (pendingStatusChanges.length > 0) {
      await commitPendingChanges();
    }

    // 次のページを取得
    const nextPage = currentPage + 1;
    await fetchNotifications(activeFilter, nextPage, sortBy, true);
  }, [activeFilter, commitPendingChanges, currentPage, fetchNotifications, isLoadingMore, pendingStatusChanges.length, sortBy]);

  // タブ（フィルター）切り替え時の処理
  const handleTabChange = useCallback(
    async (value: FilterType) => {
      if (value === activeFilter) return;

      try {
        // 処理中フラグを設定
        isRequestInProgressRef.current = true;

        // 保留中の変更があれば先にコミット
        if (pendingStatusChanges.length > 0) {
          await commitPendingChanges();

          // コミット後に少し待機して、サーバーサイドの処理が完了するのを待つ
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        dispatch({ type: "SET_FILTER", payload: value });

        // 新しいフィルターで通知を取得
        await fetchNotifications(value, 1, sortBy, false);
      } catch (error) {
        console.error("タブ切り替え中にエラーが発生しました:", error);
        dispatch({ type: "FETCH_ERROR", payload: "タブ切り替え中にエラーが発生しました" });
      } finally {
        isRequestInProgressRef.current = false;
      }
    },
    [activeFilter, commitPendingChanges, fetchNotifications, pendingStatusChanges.length, sortBy],
  );

  // ソート方法変更時の処理
  const handleSortChange = useCallback(
    async (value: SortType) => {
      if (value === sortBy) return;

      try {
        // 処理中フラグを設定
        isRequestInProgressRef.current = true;

        // 保留中の変更があれば先にコミット
        if (pendingStatusChanges.length > 0) {
          await commitPendingChanges();

          // コミット後に少し待機して、サーバーサイドの処理が完了するのを待つ
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        dispatch({ type: "SET_SORT", payload: value });

        // 新しいソートで通知を取得
        await fetchNotifications(activeFilter, 1, value, false);
      } catch (error) {
        console.error("ソート切り替え中にエラーが発生しました:", error);
        dispatch({ type: "FETCH_ERROR", payload: "ソート切り替え中にエラーが発生しました" });
      } finally {
        isRequestInProgressRef.current = false;
      }
    },
    [activeFilter, commitPendingChanges, fetchNotifications, pendingStatusChanges.length, sortBy],
  );

  const isFirstMountRef = useRef(true);
  // 初回マウント時の処理
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;

      // 初期化状態を設定
      isInitializedRef.current = false;
      isMountedRef.current = true;

      // 初回データ取得（遅延実行して初期レンダリングの妨げにならないようにする）
      const initialFetchTimer = setTimeout(() => {
        fetchNotifications(activeFilter, 1, sortBy, false);
      }, 0);

      // 定期的な通知取得
      const refreshTimer = setInterval(() => {
        // アクティブなタブかつ初期化済みの場合のみ更新
        if (document.visibilityState === "visible" && isInitializedRef.current && !isRequestInProgressRef.current) {
          // 保留中の変更があれば先にコミット
          if (pendingStatusChanges.length > 0) {
            commitPendingChanges();
          } else {
            fetchNotifications(activeFilter, 1, sortBy, false);
          }
        }
      }, REFRESH_INTERVAL);

      // クリーンアップ関数
      return () => {
        // アンマウント時に保留中の変更をコミット
        if (pendingStatusChanges.length > 0) {
          commitPendingChanges();
        }

        clearTimeout(initialFetchTimer);
        clearInterval(refreshTimer);

        if (commitTimerRef.current) {
          clearTimeout(commitTimerRef.current);
        }

        isMountedRef.current = false;
      };
    }
  }, [activeFilter, commitPendingChanges, fetchNotifications, pendingStatusChanges.length, sortBy]); // 初回マウント時のみ実行

  // 表示領域の変更を検出（タブが非表示になったときなど）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && pendingStatusChanges.length > 0) {
        // タブが非表示になる時、保留中の変更をコミット
        commitPendingChanges();
      } else if (document.visibilityState === "visible" && isInitializedRef.current && !isRequestInProgressRef.current) {
        // タブが表示されたら最新データを取得（保留中の変更がなければ）
        if (pendingStatusChanges.length === 0) {
          fetchNotifications(activeFilter, 1, sortBy, false);
        }
      }
    };

    // ブラウザの表示状態変更イベントリスナー
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // クリーンアップ関数
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeFilter, commitPendingChanges, fetchNotifications, pendingStatusChanges.length, sortBy]);

  // アンロードハンドラー（ページ移動時に保留中の変更をコミット）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingStatusChanges.length > 0) {
        commitPendingChanges();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [commitPendingChanges, pendingStatusChanges.length]);

  // 表示する通知をフィルタリング（パフォーマンス向上のためメモ化）
  const displayedNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "unread") return !notification.isRead;
      return notification.isRead; // "read" フィルター
    });
  }, [notifications, activeFilter]);

  // 再試行ハンドラー
  const handleRetry = useCallback(() => {
    fetchNotifications(activeFilter, 1, sortBy, false);
  }, [activeFilter, fetchNotifications, sortBy]);

  // 保留中の変更の数を表示するカウンター
  const pendingChangesCount = useMemo(() => pendingStatusChanges.length, [pendingStatusChanges.length]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* ヘッダー部分 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800">{unreadCount > 0 ? `${unreadCount}件の未読` : "未読はありません"}</span>
          {pendingChangesCount > 0 && <span className="text-xs text-gray-500">({pendingChangesCount}件の変更を保存中...)</span>}
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsReadLocal}
            disabled={isProcessingAllRead || isCommittingChanges}
            className="bg-gray-100 text-xs text-gray-800 hover:bg-gray-300"
          >
            {isProcessingAllRead || isCommittingChanges ? (
              <>
                <LoadingIndicator />
                処理中...
              </>
            ) : (
              "すべて既読にする"
            )}
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
          <TabsTrigger value="all" disabled={isProcessingAllRead || isCommittingChanges}>
            すべて
          </TabsTrigger>
          <TabsTrigger value="unread" disabled={isProcessingAllRead || isCommittingChanges}>
            未読
          </TabsTrigger>
          <TabsTrigger value="read" disabled={isProcessingAllRead || isCommittingChanges}>
            既読
          </TabsTrigger>
        </TabsList>

        {/* ソート選択部分 */}
        <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortType)} disabled={isProcessingAllRead || isCommittingChanges}>
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
                  <Button variant="outline" size="sm" className="mt-2" onClick={handleRetry}>
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
                            onToggleReadStatus={toggleReadStatusLocal}
                            isProcessingToggleRead={isProcessingToggleRead}
                          />
                        ))}
                      </ul>

                      {/* もっと読み込むボタン */}
                      {hasMore && (
                        <div className="mt-auto flex justify-center py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadMoreNotifications}
                            disabled={isLoadingMore || isProcessingAllRead || isCommittingChanges}
                            className="w-full text-sm"
                          >
                            {isLoadingMore || isCommittingChanges ? (
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
                    /* 修正: NotificationsEmptyコンポーネントにもっと読み込む機能を追加 */
                    <NotificationsEmpty
                      filterType={activeFilter}
                      hasMore={hasMore}
                      onLoadMore={loadMoreNotifications}
                      isLoadingMore={isLoadingMore}
                      isProcessingAllRead={isProcessingAllRead}
                      isCommittingChanges={isCommittingChanges}
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
