import { useState } from "react";

import { oauthClientListSchema } from "../../../../shared/schemas/oauth-client-schema";
import { BffError } from "../../../lib/api-client";
import { authClient } from "../../../lib/auth-client";
import { useBffResource } from "./use-bff-resource";

/**
 * 「設定」画面の退会。
 * 終了する登録OAuthクライアントを読み込み、「内容を確認した」の確認後にBetter Auth標準の`deleteUser`で退会する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-account-deletion.test.tsx
 */
export function useAccountDeletion({ onDeleted }: { onDeleted: () => void }) {
  const clients = useBffResource("/api/oauth-clients", oauthClientListSchema);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  // 終了するクライアントを本人が確認できるよう、一覧を読み込めた後に限り実行できる。
  const canDelete = isConfirmed && clients.data !== null && !isDeleting;

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
    clients: clients.data?.clients ?? null,
    clientsError: clients.error,
    isClientsLoading: clients.isLoading,
    reloadClients: clients.reload,
    isConfirmed,
    changeConfirmed: (value: boolean) => setIsConfirmed(value),
    canDelete,
    isDeleting,
    deleteError,
    deleteAccount,
  };
}

export type AccountDeletion = ReturnType<typeof useAccountDeletion>;
