import type { NotificationData } from "@/actions/notification/cache-notification-list";

/**
 * useInfiniteQuery の queryFn が返す各ページのデータ型
 * use-notification-list.ts と use-notification-button.ts で共通利用
 */
export type QueryFnReturnType = {
  notifications: NotificationData[];
  totalCount: number;
  unreadCount: number; // このページ取得時の全体の未読数
  readCount: number; // このページ取得時の全体の既読数
};
