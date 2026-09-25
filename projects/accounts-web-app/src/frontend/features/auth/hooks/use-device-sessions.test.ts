// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDeviceSessions } from "./use-device-sessions";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  getSession: vi.fn<AuthClientCall>(),
  multiSession: { listDeviceSessions: vi.fn<AuthClientCall>(), setActive: vi.fn<AuthClientCall>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

/**
 * `listDeviceSessions`・`getSession`の1件分の応答を作る。
 */
function deviceSession(sessionId: string, userId: string, name: string) {
  return {
    session: { id: sessionId, token: `token-${sessionId}`, userId },
    user: { id: userId, name },
  };
}

const alice = deviceSession("session-a", "ausr_alice", "Alice");
const bob = deviceSession("session-b", "ausr_bob", "Bob");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useDeviceSessions", () => {
  it("ログイン中のセッション一覧と現在のセッションを読み込む", async () => {
    authClientMock.getSession.mockResolvedValue({ data: alice, error: null });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });

    const { result } = renderHook(() => useDeviceSessions());

    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("loaded"));
    expect(result.current.state).toEqual({
      status: "loaded",
      currentSessionId: "session-a",
      sessions: [
        { sessionId: "session-a", sessionToken: "token-session-a", accountsUserId: "ausr_alice", displayName: "Alice" },
        { sessionId: "session-b", sessionToken: "token-session-b", accountsUserId: "ausr_bob", displayName: "Bob" },
      ],
    });
  });

  it("ログインしていない場合は、現在のセッションが無い空の一覧になる", async () => {
    authClientMock.getSession.mockResolvedValue({ data: null, error: null });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useDeviceSessions());

    await waitFor(() => expect(result.current.state).toEqual({ status: "loaded", currentSessionId: null, sessions: [] }));
  });

  it("一覧の取得に失敗した場合は失敗の状態にする", async () => {
    authClientMock.getSession.mockResolvedValue({ data: alice, error: null });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: null, error: { status: 500 } });

    const { result } = renderHook(() => useDeviceSessions());

    await waitFor(() => expect(result.current.state.status).toBe("failed"));
  });

  it("切り替えると、指定したセッションが現在のセッションになる", async () => {
    authClientMock.getSession.mockResolvedValue({ data: alice, error: null });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: bob, error: null });
    const { result } = renderHook(() => useDeviceSessions());
    await waitFor(() => expect(result.current.state.status).toBe("loaded"));

    await act(() => result.current.switchSession("token-session-b"));

    expect(authClientMock.multiSession.setActive).toHaveBeenCalledWith({ sessionToken: "token-session-b" });
    expect(result.current.state).toMatchObject({ status: "loaded", currentSessionId: "session-b" });
    expect(result.current.switchingToken).toBeNull();
    expect(result.current.hasSwitched).toBe(true);
    expect(result.current.hasSwitchFailed).toBe(false);
  });

  it("切り替えに失敗した場合は、現在のセッションを変えずに失敗を保持する", async () => {
    authClientMock.getSession.mockResolvedValue({ data: alice, error: null });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });
    authClientMock.multiSession.setActive.mockResolvedValue({ data: null, error: { status: 401 } });
    const { result } = renderHook(() => useDeviceSessions());
    await waitFor(() => expect(result.current.state.status).toBe("loaded"));

    await act(() => result.current.switchSession("token-session-b"));

    expect(result.current.state).toMatchObject({ status: "loaded", currentSessionId: "session-a" });
    expect(result.current.switchingToken).toBeNull();
    expect(result.current.hasSwitched).toBe(false);
    expect(result.current.hasSwitchFailed).toBe(true);
  });
});
