"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDeliveryMethod } from "@/lib/auction/action/history";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 提供方法管理のカスタムフックの型定義
 */
type UseDeliveryMethodResult = {
  deliveryMethod: string;
  setDeliveryMethod: (deliveryMethod: string) => void;
  isEditingDelivery: boolean;
  isUpdatingDelivery: boolean;
  handleUpdateDeliveryMethod: () => void;
  cancelEditing: () => void;
  startEditing: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 提供方法管理のカスタムフック
 * @param taskId タスクID
 * @param initialDeliveryMethod 初期提供方法
 * @returns 提供方法関連の状態と関数
 */
export function useDeliveryMethod(taskId: string, initialDeliveryMethod: string): UseDeliveryMethodResult {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ルーター
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deliveryMethod, setDeliveryMethod] = useState(initialDeliveryMethod);
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const { mutate: updateDeliveryMethodMutation, isPending: isUpdatingDelivery } = useMutation({
    mutationFn: (newDeliveryMethod: string) => updateDeliveryMethod(taskId, newDeliveryMethod),
    onSuccess: (_, _newDeliveryMethod) => {
      toast.success("提供方法を更新しました");
      setIsEditingDelivery(false);
      void queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      router.refresh();
    },
    onError: (error) => {
      console.error("提供方法の更新に失敗しました", error);
      toast.error("提供方法の更新に失敗しました");
    },
  });

  const handleUpdateDeliveryMethod = useCallback(() => {
    if (!deliveryMethod.trim()) {
      toast.error("提供方法を入力してください");
      return;
    }
    updateDeliveryMethodMutation(deliveryMethod);
  }, [deliveryMethod, updateDeliveryMethodMutation]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const cancelEditing = useCallback(() => {
    setIsEditingDelivery(false);
    setDeliveryMethod(initialDeliveryMethod);
  }, [initialDeliveryMethod]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const startEditing = useCallback(() => {
    setIsEditingDelivery(true);
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    deliveryMethod,
    setDeliveryMethod,
    isEditingDelivery,
    isUpdatingDelivery,
    handleUpdateDeliveryMethod,
    cancelEditing,
    startEditing,
  };
}
