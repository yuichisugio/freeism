import { useState } from "react";

import type { LinkedAccount } from "../../../../shared/schemas/account-link-schema";
import { verifyUrlResultSchema } from "../../../../shared/schemas/external-url-schema";
import { requestBff } from "../../../lib/api-client";

/**
 * 未検証の行の「再検証」。
 * 行の主URLを「検証する」と同じ`POST /api/external-urls`（`mode: "verify"`）で送る。
 * 試行の結果は一覧の再取得で行の直近の検証結果に反映する。
 * @see ../../../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./use-reverify.test.tsx
 */
export function useReverify({ onVerified }: { onVerified: () => Promise<void> }) {
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ accountId: string; error: unknown } | null>(null);

  /**
   * 行の主URLを再検証し、成功した応答の後に一覧を再取得する。
   * 頻度制限などで拒否された場合は、その行の失敗として保持する。
   */
  const reverify = async (account: LinkedAccount) => {
    if (account.primaryUrl === null) return;
    setPendingAccountId(account.id);
    setFailure(null);
    try {
      await requestBff("/api/external-urls", verifyUrlResultSchema, {
        method: "POST",
        body: { url: account.primaryUrl, mode: "verify" },
      });
      await onVerified();
    } catch (error) {
      setFailure({ accountId: account.id, error });
    }
    setPendingAccountId(null);
  };

  return { reverify, pendingAccountId, failure };
}
