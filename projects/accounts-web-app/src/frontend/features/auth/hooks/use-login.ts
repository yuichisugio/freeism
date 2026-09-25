import { useState } from "react";

import type { LoginProviderId } from "../../../../shared/providers";
import { authClient } from "../../../lib/auth-client";

/**
 * ログインの開始と、前回のログイン方法。
 * Google・GitHubとGeneric OAuthのORCIDは、Better Auth標準の`signIn.social()`で開始する。
 * OAuth Providerのログイン画面として開いた場合は、`oauthProviderClient`が署名付きクエリを要求へ引き継ぐ。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-login.test.ts
 */
export function useLogin() {
  const [pendingProvider, setPendingProvider] = useState<LoginProviderId | null>(null);
  const [hasStartFailed, setHasStartFailed] = useState(false);
  // cookie由来の値のため、描画のたびに読み直さず初回だけ読む。
  const [lastUsedMethod] = useState(() => authClient.getLastUsedLoginMethod());

  /**
   * Providerの認証画面へ移動する。
   * 成功時はブラウザーが移動するため、開始中の状態を保つ。
   */
  const signIn = async (provider: LoginProviderId) => {
    setPendingProvider(provider);
    setHasStartFailed(false);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/account-links",
        errorCallbackURL: "/",
      });
      if (error === null) return;
    } catch {
      // 通信の失敗も、応答の失敗と同じく再度押せる状態に戻す。
    }
    setHasStartFailed(true);
    setPendingProvider(null);
  };

  return { pendingProvider, hasStartFailed, lastUsedMethod, signIn };
}
