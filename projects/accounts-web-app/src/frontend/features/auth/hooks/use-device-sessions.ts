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
 * 同じブラウザー内でログイン中のAccountsユーザーの一覧と切替（Multi Session）。
 * ログアウト・切替などで現在のセッションが変わると、一覧を読み直す。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-device-sessions.test.ts
 */
export function useDeviceSessions() {
  const [state, setState] = useState<DeviceSessionsState>({ status: "loading" });
  const [switchingToken, setSwitchingToken] = useState<string | null>(null);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [hasSwitchFailed, setHasSwitchFailed] = useState(false);
  // セッションのtokenはHttpOnlyのcookieにあるため、現在のセッションは標準の`useSession`で判別する。
  const session = authClient.useSession();
  const currentSessionId = session.isPending ? undefined : (session.data?.session.id ?? null);

  useEffect(() => {
    if (currentSessionId === undefined) return;
    let isActive = true;
    void readDeviceSessions(currentSessionId).then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, [currentSessionId]);

  /**
   * 指定したセッションを現在のセッションにする。
   */
  const switchSession = async (sessionToken: string) => {
    setSwitchingToken(sessionToken);
    setHasSwitched(false);
    setHasSwitchFailed(false);
    try {
      const { data, error } = await authClient.multiSession.setActive({ sessionToken });
      if (error !== null) {
        setHasSwitchFailed(true);
      } else if (data?.session) {
        const currentSessionId = data.session.id;
        setState((current) => (current.status === "loaded" ? { ...current, currentSessionId } : current));
        setHasSwitched(true);
      }
    } catch {
      setHasSwitchFailed(true);
    } finally {
      setSwitchingToken(null);
    }
  };

  return { state, switchingToken, hasSwitched, hasSwitchFailed, switchSession };
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
