"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDeliveryMethod } from "@/lib/auction/action/history";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

type UseDeliveryMethodResult = {
  deliveryMethod: string;
  setDeliveryMethod: (deliveryMethod: string) => void;
  isEditingDelivery: boolean;
  isUpdatingDelivery: boolean;
  handleUpdateDeliveryMethod: () => Promise<void>;
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

  // 提供方法
  const [deliveryMethod, setDeliveryMethod] = useState(initialDeliveryMethod);

  // 編集モード
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);

  // 更新モード
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 提供方法を更新する
  const handleUpdateDeliveryMethod = useCallback(async () => {
    if (!deliveryMethod.trim()) {
      toast.error("提供方法を入力してください");
      return;
    }

    setIsUpdatingDelivery(true);
    try {
      await updateDeliveryMethod(taskId, deliveryMethod);
      toast.success("提供方法を更新しました");
      setIsEditingDelivery(false);
      router.refresh();
    } catch (error) {
      console.error("提供方法の更新に失敗しました", error);
      toast.error("提供方法の更新に失敗しました");
    } finally {
      setIsUpdatingDelivery(false);
    }
  }, [taskId, deliveryMethod, router]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 編集をキャンセルする
  const cancelEditing = useCallback(() => {
    setIsEditingDelivery(false);
    setDeliveryMethod(initialDeliveryMethod);
  }, [initialDeliveryMethod]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 編集モードを開始する
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
