import { useEffect, useState } from "react";

import { authClient } from "../../../lib/auth-client";

/**
 * このブラウザーでログイン中のAccountsユーザーのセッション。
 */
export type DeviceSessionSummary = {
  sessionId: string;
  sessionToken: string;
  accountsUserId: string;
  displayName: string;
};

/**
 * セッション一覧の読み込み状態。
 */
export type DeviceSessionsState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "loaded"; sessions: DeviceSessionSummary[]; currentSessionId: string | null };

/**
 * 同じブラウザー内でログイン中のAccountsユーザーの一覧（Multi Session）。
 * ログアウト・切替などで現在のセッションが変わったときと、現在のユーザーの表示名が変わったときに、一覧を読み直す。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-device-sessions.test.ts
 */
export function useDeviceSessions() {
  const [state, setState] = useState<DeviceSessionsState>({ status: "loading" });
  // セッションのtokenはHttpOnlyのcookieにあるため、現在のセッションは標準の`useSession`で判別する。
  const session = authClient.useSession();
  const currentSessionId = session.isPending ? undefined : (session.data?.session.id ?? null);
  const currentUserName = session.data?.user.name;

  useEffect(() => {
    if (currentSessionId === undefined) return;
    let isActive = true;
    void readDeviceSessions(currentSessionId).then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, [currentSessionId, currentUserName]);

  return state;
}

// --------------------------------------------------
// 読み込み
// --------------------------------------------------

/**
 * このブラウザーのセッション一覧を読む。
 */
async function readDeviceSessions(currentSessionId: string | null): Promise<DeviceSessionsState> {
  try {
    const list = await authClient.multiSession.listDeviceSessions();
    if (list.error !== null) return { status: "failed" };
    return {
      status: "loaded",
      currentSessionId,
      sessions: list.data.map(({ session, user }) => ({
        sessionId: session.id,
        sessionToken: session.token,
        accountsUserId: user.id,
        displayName: user.name,
      })),
    };
  } catch {
    return { status: "failed" };
  }
}
