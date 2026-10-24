import { useState } from "react";

import type { LoginProviderId } from "../../../../shared/providers";
import { authClient } from "../../../lib/auth-client";

/**
 * Google・GitHub・ORCIDの追加連携。
 * Better Auth標準の`linkSocial`で外部の認証画面へ移動し、戻り先はこの画面（`returnPath`。AccountsユーザーID付きの経路）とする。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-provider-link.test.tsx
 */
export function useProviderLink(returnPath: string) {
  const [pendingProvider, setPendingProvider] = useState<LoginProviderId | null>(null);
  const [error, setError] = useState<unknown>(null);

  /**
   * 追加連携を開始する。
   * 成功すると外部の認証画面へ移動するが、未保存の変更の確認で画面に留まる場合もあるため、応答後は再度押せる状態に戻す。
   */
  const link = async (provider: LoginProviderId) => {
    setPendingProvider(provider);
    setError(null);
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: returnPath,
        errorCallbackURL: returnPath,
      });
      if (result.error) setError(result.error);
    } catch (linkError) {
      setError(linkError);
    }
    setPendingProvider(null);
  };

  return { link, pendingProvider, error };
}
