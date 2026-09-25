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
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./use-device-sessions.test.ts
 */
export function useDeviceSessions() {
  const [state, setState] = useState<DeviceSessionsState>({ status: "loading" });
  const [switchingToken, setSwitchingToken] = useState<string | null>(null);
  const [hasSwitched, setHasSwitched] = useState(false);
  const [hasSwitchFailed, setHasSwitchFailed] = useState(false);

  useEffect(() => {
    let isActive = true;
    void readDeviceSessions().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, []);

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
 * 現在のセッションと、このブラウザーのセッション一覧を読む。
 * セッションのtokenはHttpOnlyのcookieにあるため、現在のセッションは`getSession`で判別する。
 */
async function readDeviceSessions(): Promise<DeviceSessionsState> {
  try {
    const [current, list] = await Promise.all([
      authClient.getSession(),
      authClient.multiSession.listDeviceSessions(),
    ]);
    if (current.error !== null || list.error !== null) return { status: "failed" };
    return {
      status: "loaded",
      currentSessionId: current.data?.session.id ?? null,
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
