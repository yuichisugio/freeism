import { useLocation, useMatches, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { useHydratedSession } from "../../../lib/use-hydrated-session";
import { useLoginDialog } from "./use-login-dialog";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * ユーザーの情報を扱わない画面（ヘルプ・規約など）か。
     * URLのユーザーでこのブラウザーにログインしていなくても、ログインを求めずに現在のユーザーの画面として表示する。
     */
    isUserIndependent?: boolean;
  }
}

/**
 * URLのAccountsユーザーIDと現在のセッションを揃える状態。
 * `checking`はセッションの確認・切替・ID付きのURLへの置き換えの途中。
 * `signInRequired`は、URLのユーザーでこのブラウザーにログインしていない状態で、`openLogin`でログイン用のダイアログを開き直せる。
 */
export type UserScope =
  | { status: "checking" | "ready" | "switchFailed" }
  | { status: "signInRequired"; accountsUserId: string; openLogin: () => void };

/**
 * URLのユーザーへの切替が済まなかった結果。
 */
type ActivationFailure = { urlUserId: string; status: "signInRequired" | "switchFailed" };

/**
 * URLのユーザーをこのブラウザーのセッションから探して切り替えた結果。
 */
type ActivationResult = "switched" | "signInRequired" | "switchFailed";

/**
 * 画面のURL（`/{accountsUserId}/...`）のユーザーと、現在の有効セッションのユーザーを揃える。
 * URLのIDは表示するユーザーの切替だけに使い、BFFはCookieのセッションで本人を判定する。
 * - IDの無いURLは、ログイン済みなら現在のユーザーのID付きのURLへ置き換え、未ログインならそのまま表示する。
 * - IDが現在のユーザーと違えば、このブラウザーでログイン中のセッションにそのユーザーがあれば`setActive`で切り替え、無ければログイン用のダイアログを開き、ログイン後に同じURLへ戻す。
 * - ユーザーの情報を扱わない画面（経路の`staticData.isUserIndependent`）では、URLのユーザーでログインしていなければ、現在のユーザーのID付き（未ログインならIDの無い）URLへ置き換える。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ../components/user-scope-gate.test.tsx
 */
export function useUserScope(): UserScope {
  const { accountsUserId: urlUserId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  // URLのユーザーでのログインに失敗して戻された場合は、Better Authが`?error=`を付ける。
  const loginErrorParam = useLocation({ select: (location) => location.search.error });
  const loginErrorCode = typeof loginErrorParam === "string" ? loginErrorParam : undefined;
  const isUserIndependent = useMatches({
    select: (matches) => matches.some((match) => match.staticData.isUserIndependent === true),
  });
  const navigate = useNavigate();
  const loginDialog = useLoginDialog();
  const session = useHydratedSession();
  const sessionUserId = session.isPending ? undefined : (session.data?.user.id ?? null);
  const [failure, setFailure] = useState<ActivationFailure | null>(null);

  useEffect(() => {
    if (sessionUserId === undefined) return;
    if (urlUserId === undefined) {
      if (sessionUserId !== null) {
        void navigate({ to: ".", params: { accountsUserId: sessionUserId }, search: true, hash: true, replace: true });
      }
      return;
    }
    if (urlUserId === sessionUserId) return;
    let isActive = true;
    void activateDeviceSession(urlUserId).then((result) => {
      if (!isActive || result === "switched") return;
      if (result === "signInRequired" && isUserIndependent) {
        void navigate({
          to: ".",
          params: { accountsUserId: sessionUserId ?? undefined },
          search: true,
          hash: true,
          replace: true,
        });
        return;
      }
      setFailure({ urlUserId, status: result });
      if (result === "signInRequired") loginDialog.open({ errorCode: loginErrorCode, returnTo: pathname });
    });
    return () => {
      isActive = false;
    };
  }, [urlUserId, sessionUserId, isUserIndependent, pathname, loginErrorCode, navigate, loginDialog]);

  if (sessionUserId === undefined) return { status: "checking" };
  if (urlUserId === undefined) return { status: sessionUserId === null ? "ready" : "checking" };
  if (urlUserId === sessionUserId) return { status: "ready" };
  if (failure?.urlUserId !== urlUserId) return { status: "checking" };
  if (failure.status === "switchFailed") return { status: "switchFailed" };
  return {
    status: "signInRequired",
    accountsUserId: urlUserId,
    openLogin: () => loginDialog.open({ returnTo: pathname }),
  };
}

// --------------------------------------------------
// 切替
// --------------------------------------------------

/**
 * このブラウザーでログイン中のセッションから指定したユーザーを探し、現在のセッションにする。
 * 切り替えると、Multi Sessionのクライアントが現在のセッションを読み直す。
 */
async function activateDeviceSession(accountsUserId: string): Promise<ActivationResult> {
  try {
    const list = await authClient.multiSession.listDeviceSessions();
    if (list.error !== null) return "switchFailed";
    const target = list.data.find(({ user }) => user.id === accountsUserId);
    if (target === undefined) return "signInRequired";
    const result = await authClient.multiSession.setActive({ sessionToken: target.session.token });
    return result.error === null ? "switched" : "switchFailed";
  } catch {
    return "switchFailed";
  }
}
