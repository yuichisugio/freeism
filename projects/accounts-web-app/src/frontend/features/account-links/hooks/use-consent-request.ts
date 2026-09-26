import { useEffect, useState } from "react";

import { authClient } from "../../../lib/auth-client";
import type { RawSearch } from "../../../lib/search-params";

/**
 * 同意画面モード（OAuth Providerの`consentPage`として開いた場合）。
 * 署名付きクエリから今回の連携先・戻り先・期限を読み、Better Auth標準の`oauth2.consent`で戻る。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-consent-request.test.tsx
 */

/**
 * 署名付きクエリから読み取る認可要求。
 * `expiresAt`は署名付きクエリの`exp`（UNIX秒）をミリ秒にした値。
 */
export type ConsentRequest = {
  clientId: string;
  redirectHost: string | null;
  expiresAt: number | null;
};

/**
 * `setTimeout`に指定できる最大の遅延（2^31 - 1 ms）。
 */
const maxTimerDelayMs = 2_147_483_647;

type ConsentState = { status: "idle" } | { status: "submitting" } | { status: "failed" };

function readSingle(search: RawSearch, key: string): string | null {
  const value = search[key];
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * クエリが署名付きの認可要求なら、その内容を返す。
 */
export function parseConsentRequest(search: RawSearch): ConsentRequest | null {
  const clientId = readSingle(search, "client_id");
  if (clientId === null || readSingle(search, "sig") === null) return null;
  const redirectUri = readSingle(search, "redirect_uri");
  const expiresAtSeconds = Number(readSingle(search, "exp"));
  return {
    clientId,
    redirectHost: redirectUri !== null && URL.canParse(redirectUri) ? new URL(redirectUri).host : null,
    expiresAt: Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0 ? expiresAtSeconds * 1000 : null,
  };
}

/**
 * 期限を過ぎたかを返し、期限の時刻に表示を切り替える。
 */
function useIsExpired(expiresAt: number | null): boolean {
  const [isExpired, setIsExpired] = useState(() => expiresAt !== null && expiresAt <= Date.now());

  useEffect(() => {
    if (expiresAt === null) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      setIsExpired(true);
      return;
    }
    setIsExpired(false);
    // setTimeoutは約24.8日を超える遅延を即時に実行するため、それより先の期限では切替を予約しない。
    // 署名付きクエリの期限は10分のため、実際の画面では常に予約される。
    if (remaining > maxTimerDelayMs) return;
    const timer = window.setTimeout(() => setIsExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  return isExpired;
}

/**
 * 同意画面の状態と「同意して戻る」「同意しない」。
 */
export function useConsentRequest(search: RawSearch) {
  const request = parseConsentRequest(search);
  const isExpired = useIsExpired(request?.expiresAt ?? null);
  const [state, setState] = useState<ConsentState>({ status: "idle" });

  /**
   * 標準の同意エンドポイントを呼ぶ。
   * 成功時はBetter Authのクライアントが戻り先へ移動するため、送信中の状態を保つ。
   */
  const sendConsent = async (accept: boolean) => {
    try {
      const result = await authClient.oauth2.consent({ accept });
      if (result.error) setState({ status: "failed" });
    } catch {
      setState({ status: "failed" });
    }
  };

  /**
   * 今回の連携先への同意をONで保存した後に、認可コードを発行して戻る。
   * `saveWithConsent`は公開設定の保存で、失敗した場合は同意を送らない。
   */
  const accept = async (saveWithConsent: () => Promise<boolean>) => {
    setState({ status: "submitting" });
    if (!(await saveWithConsent())) {
      setState({ status: "idle" });
      return;
    }
    await sendConsent(true);
  };

  /**
   * 連携を成立させずに戻る。
   * 保存済みの同意と公開設定は変更しない。
   */
  const deny = async () => {
    setState({ status: "submitting" });
    await sendConsent(false);
  };

  return {
    request,
    isExpired,
    isSubmitting: state.status === "submitting",
    hasFailed: state.status === "failed",
    accept,
    deny,
  };
}
