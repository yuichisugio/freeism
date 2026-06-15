"use client";

import { useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフックの戻り値の型
 */
type UseGroupDetailModalReturn = {
  // state
  isUploadModalOpen: boolean;
  isExportModalOpen: boolean;

  // action
  setIsUploadModalOpen: (open: boolean) => void;
  setIsExportModalOpen: (open: boolean) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループタスク用のカスタムフック
 */
export function useGroupDetailModal(): UseGroupDetailModalReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * state
   */
  // モーダーの表示状態
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  // データエクスポートモーダーの表示状態
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 戻り値
   */
  return {
    // state
    isUploadModalOpen,
    isExportModalOpen,

    // functions
    setIsUploadModalOpen,
    setIsExportModalOpen,
  };
}
