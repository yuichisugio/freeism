"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { completeTaskDelivery } from "@/lib/auction/action/history";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理のカスタムフックの型
 */
type UseTaskCompletionResult = {
  isCompleting: boolean;
  handleComplete: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理のカスタムフック
 * @param taskId タスクID
 * @returns タスク完了関連の状態と関数
 */
export function useTaskCompletion(taskId: string): UseTaskCompletionResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const router = useRouter();
  const queryClient = useQueryClient();

  const { mutate: completeTaskDeliveryMutation, isPending: isCompleting } = useMutation({
    mutationFn: completeTaskDelivery,
    onSuccess: () => {
      toast.success("商品の提供を完了しました");
      // 関連するクエリを無効化します。
      // 例: queryClient.invalidateQueries({ queryKey: ['auctionDetails', auctionId] }); // auctionId は適切な場所から取得してください
      // または、特定のタスクに関連するクエリを無効化します。
      void queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      router.refresh();
    },
    onError: (error) => {
      console.error("完了処理に失敗しました", error);
      toast.error("完了処理に失敗しました");
    },
  });

  const handleComplete = useCallback(() => {
    if (!taskId) {
      toast.error("タスクIDが指定されていません。");
      return;
    }
    completeTaskDeliveryMutation(taskId);
  }, [completeTaskDeliveryMutation, taskId]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    isCompleting,
    handleComplete,
  };
}
