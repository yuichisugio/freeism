import type { NotificationData } from "@/hooks/notification/use-notification-list";
import { updateNotificationStatus } from "@/lib/actions/notification/notification-utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// 既存の useInfiniteQuery から返されるデータの型構造に合わせる
type InfiniteQueryData = {
  pages: {
    notifications: NotificationData[];
    totalCount: number;
    unreadCount: number;
    readCount: number;
  }[];
  pageParams: number[];
};

export function useToggleRead(userId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["toggleNotificationStatus", userId], // userId もキーに含めることで、ユーザーごとのmutationを区別
    mutationFn: async (vars: { id: string; isRead: boolean }) => updateNotificationStatus([{ notificationId: vars.id, isRead: vars.isRead }]),

    onMutate: async (vars: { id: string; isRead: boolean }) => {
      // 既存のクエリをキャンセル
      await qc.cancelQueries({ queryKey: ["notifications", userId] });

      // 現在のキャッシュデータを取得
      const previousNotificationsData = qc.getQueriesData<InfiniteQueryData>({
        queryKey: ["notifications", userId],
      });

      // キャッシュ内のデータを楽観的に更新
      qc.setQueriesData<InfiniteQueryData>(
        { queryKey: ["notifications", userId], exact: false }, // exact: false で部分一致するすべてのクエリを更新
        (oldData) => {
          if (!oldData) return undefined; // oldData が undefined の場合は undefined を返す
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((notification) =>
                notification.id === vars.id ? { ...notification, isRead: vars.isRead, readAt: vars.isRead ? new Date() : null } : notification,
              ),
            })),
          };
        },
      );

      return { previousNotificationsData };
    },

    onError: (_error, _variables, context) => {
      // エラーが発生した場合、onMutate から返された値を使用してデータをロールバック
      if (context?.previousNotificationsData) {
        context.previousNotificationsData.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: async () => {
      // 成功・失敗にかかわらず、関連するクエリを再検証してサーバーと同期
      await qc.invalidateQueries({ queryKey: ["notifications", userId] });
      await qc.invalidateQueries({ queryKey: ["hasUnreadNotifications", userId] });
    },
  });
}
