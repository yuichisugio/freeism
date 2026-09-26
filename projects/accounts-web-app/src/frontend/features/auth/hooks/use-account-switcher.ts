import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";
import type { DeviceSessionSummary } from "./use-device-sessions";

/**
 * アカウントのメニューの操作に失敗した種類。
 */
export type AccountSwitcherFailure = "switch" | "signOut";

/**
 * アカウントのメニューから行う、ユーザーの切替と現在のユーザーのログアウト。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ../../app-shell/components/app-header.test.tsx
 */
export function useAccountSwitcher() {
  const navigate = useNavigate();
  const router = useRouter();
  const { accountsUserId: urlUserId } = useParams({ strict: false });
  const [failure, setFailure] = useState<AccountSwitcherFailure | null>(null);

  /**
   * 指定したユーザーへ切り替える。
   * AccountsユーザーID付きの画面では、同じ画面のそのユーザーのURLへ移動し、移動先の画面がURLのユーザーへセッションを切り替える。
   * 未保存の変更がある場合は、移動の確認を経てから切り替わる。
   * IDの無い画面（トップページなど）では、その場でセッションを切り替える。
   */
  const switchTo = async (target: DeviceSessionSummary) => {
    setFailure(null);
    if (urlUserId !== undefined) {
      await navigate({ to: ".", params: { accountsUserId: target.accountsUserId }, search: true, hash: true });
      return;
    }
    try {
      const { error } = await authClient.multiSession.setActive({ sessionToken: target.sessionToken });
      if (error !== null) setFailure("switch");
    } catch {
      setFailure("switch");
    }
  };

  /**
   * トップページへ移動してから、現在のユーザーのセッションだけを終了する。
   * 先に移動することで、未保存の変更がある場合は移動の確認を経てからログアウトする。
   * Multi Sessionの`revoke`は、このブラウザーにほかのユーザーのセッションがあれば、そのユーザーを現在のセッションにする。
   * `revoke`は現在のセッションの読み直しを通知しないため、成功後に通知する。
   */
  const signOut = async (sessionToken: string) => {
    setFailure(null);
    await navigate({ to: "/" });
    // 未保存の確認で「編集に戻る」を選んだ場合は移動していないため、ログアウトしない。
    if (router.state.location.pathname !== "/") return;
    try {
      const { error } = await authClient.multiSession.revoke({ sessionToken });
      if (error !== null) {
        setFailure("signOut");
        return;
      }
      authClient.$store.notify("$sessionSignal");
    } catch {
      setFailure("signOut");
    }
  };

  return { failure, switchTo, signOut };
}
