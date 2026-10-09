import { useState } from "react";

import { BffError } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";

/**
 * 退会の確認で入力を求める文字列。
 */
const deletionConfirmationText = "DELETE";

/**
 * 「その他」画面の退会。
 * 確認のダイアログで「DELETE」と完全一致する入力を受けてから、Better Auth標準の`deleteUser`で退会する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-account-deletion.test.tsx
 */
export function useAccountDeletion({ onDeleted }: { onDeleted: () => void }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const canDelete = confirmationText === deletionConfirmationText && !isDeleting;

  /**
   * 確認を閉じ、入力と失敗を空に戻す。
   */
  const closeDialog = () => {
    setIsDialogOpen(false);
    setConfirmationText("");
    setDeleteError(null);
  };

  const deleteAccount = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await authClient.deleteUser();
      if (error) {
        // Better Authの失敗はHTTPステータスで共通の文言にする。
        setDeleteError(new BffError(error.status, null));
        setIsDeleting(false);
        return;
      }
      onDeleted();
    } catch (error) {
      setDeleteError(error);
      setIsDeleting(false);
    }
  };

  return {
    isDialogOpen,
    openDialog: () => setIsDialogOpen(true),
    closeDialog,
    confirmationText,
    changeConfirmationText: (value: string) => setConfirmationText(value),
    canDelete,
    isDeleting,
    deleteError,
    deleteAccount,
  };
}

export type AccountDeletion = ReturnType<typeof useAccountDeletion>;
