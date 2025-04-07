"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { completeTaskDelivery } from "@/lib/auction/action/history";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理のカスタムフックの型
 */
type UseTaskCompletionResult = {
  isCompleting: boolean;
  handleComplete: () => Promise<void>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク完了処理のカスタムフック
 * @param taskId タスクID
 * @returns タスク完了関連の状態と関数
 */
export function useTaskCompletion(taskId: string): UseTaskCompletionResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター
  const router = useRouter();

  // 商品の提供を完了するローディング
  const [isCompleting, setIsCompleting] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 商品の提供を完了する
  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      await completeTaskDelivery(taskId);
      toast.success("商品の提供を完了しました");
      router.refresh();
    } catch (error) {
      console.error("完了処理に失敗しました", error);
      toast.error("完了処理に失敗しました");
    } finally {
      setIsCompleting(false);
    }
  }, [taskId, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    isCompleting,
    handleComplete,
  };
}
