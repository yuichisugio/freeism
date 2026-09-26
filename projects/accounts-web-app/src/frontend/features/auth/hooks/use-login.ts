import { useState } from "react";

import type { LoginProviderId } from "../../../../shared/providers";
import { authClient } from "../../../lib/auth-client";

/**
 * ログインを開始できなかった理由。
 * `expired`は、OAuth Providerのログイン画面として開いた署名付きクエリの期限切れ。
 */
export type LoginStartFailure = "expired" | "failed";

/**
 * ログインの開始と、前回のログイン方法。
 * Google・GitHubとGeneric OAuthのORCIDは、Better Auth標準の`signIn.social()`で開始する。
 * OAuth Providerのログイン画面として開いた場合は、`oauthProviderClient`が署名付きクエリを要求へ引き継ぐ。
 * 戻り先（`returnTo`）の指定が無い場合は、成功時に「アカウント連携」画面（ログイン後に現在のユーザーのID付きの経路へ移る）、失敗時にトップページのログイン用のダイアログへ戻る。
 * 指定した場合は、成功時も失敗時もその画面へ戻る。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-login.test.ts
 */
export function useLogin(returnTo?: string) {
  const [pendingProvider, setPendingProvider] = useState<LoginProviderId | null>(null);
  const [startFailure, setStartFailure] = useState<LoginStartFailure | null>(null);
  // cookie由来の値のため、描画のたびに読み直さず初回だけ読む。
  const [lastUsedMethod] = useState(() => authClient.getLastUsedLoginMethod());

  /**
   * Providerの認証画面へ移動する。
   * 成功時はブラウザーが移動するため、開始中の状態を保つ。
   */
  const signIn = async (provider: LoginProviderId) => {
    setPendingProvider(provider);
    setStartFailure(null);
    let failure: LoginStartFailure = "failed";
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: returnTo ?? "/account-links",
        errorCallbackURL: returnTo ?? "/",
      });
      if (error === null) return;
      // 署名付きクエリの期限を過ぎると、ログインの開始自体が`invalid_signature`で拒否される。
      if ("error" in error && error.error === "invalid_signature") failure = "expired";
    } catch {
      // 通信の失敗も、応答の失敗と同じく再度押せる状態に戻す。
    }
    setStartFailure(failure);
    setPendingProvider(null);
  };

  return { pendingProvider, startFailure, lastUsedMethod, signIn };
}
