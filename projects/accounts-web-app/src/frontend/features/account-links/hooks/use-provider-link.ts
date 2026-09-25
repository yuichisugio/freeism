import { useState } from "react";

import type { LoginProviderId } from "../../../../shared/providers";
import { authClient } from "../../../lib/auth-client";

/**
 * Google・GitHub・ORCIDの追加連携。
 * Better Auth標準の`linkSocial`で外部の認証画面へ移動し、戻り先はこの画面とする。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 */
export function useProviderLink() {
  const [pendingProvider, setPendingProvider] = useState<LoginProviderId | null>(null);
  const [error, setError] = useState<unknown>(null);

  /**
   * 追加連携を開始する。
   * 成功すると外部の認証画面へ移動するため、開始中の状態を保つ。
   */
  const link = async (provider: LoginProviderId) => {
    setPendingProvider(provider);
    setError(null);
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: "/account-links",
        errorCallbackURL: "/account-links",
      });
      if (result.error) {
        setPendingProvider(null);
        setError(result.error);
      }
    } catch (linkError) {
      setPendingProvider(null);
      setError(linkError);
    }
  };

  return { link, pendingProvider, error };
}
