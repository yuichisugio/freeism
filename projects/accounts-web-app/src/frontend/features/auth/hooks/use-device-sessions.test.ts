// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDeviceSessions } from "./use-device-sessions";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
  multiSession: { listDeviceSessions: vi.fn<AuthClientCall>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

/**
 * `listDeviceSessions`・`useSession`の1件分の値を作る。
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
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [alice, bob], error: null });

    const { result } = renderHook(() => useDeviceSessions());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current).toEqual({
      status: "loaded",
      currentSessionId: "session-a",
      sessions: [
        { sessionId: "session-a", sessionToken: "token-session-a", accountsUserId: "ausr_alice", displayName: "Alice" },
        { sessionId: "session-b", sessionToken: "token-session-b", accountsUserId: "ausr_bob", displayName: "Bob" },
      ],
    });
  });

  it("ログインしていない場合は、現在のセッションが無い空の一覧になる", async () => {
    authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useDeviceSessions());

    await waitFor(() => expect(result.current).toEqual({ status: "loaded", currentSessionId: null, sessions: [] }));
  });

  it("ログアウトや切替で現在のセッションが変わると、一覧を読み直す", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions
      .mockResolvedValueOnce({ data: [alice, bob], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const { result, rerender } = renderHook(() => useDeviceSessions());
    await waitFor(() => expect(result.current).toMatchObject({ status: "loaded", currentSessionId: "session-a" }));

    authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
    rerender();

    await waitFor(() => expect(result.current).toEqual({ status: "loaded", currentSessionId: null, sessions: [] }));
  });

  it("現在のユーザーの表示名が変わると、一覧を読み直す", async () => {
    const renamedAlice = deviceSession("session-a", "ausr_alice", "Alicia");
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions
      .mockResolvedValueOnce({ data: [alice, bob], error: null })
      .mockResolvedValueOnce({ data: [renamedAlice, bob], error: null });
    const { result, rerender } = renderHook(() => useDeviceSessions());
    await waitFor(() => expect(result.current).toMatchObject({ status: "loaded", currentSessionId: "session-a" }));

    authClientMock.useSession.mockReturnValue({ data: renamedAlice, isPending: false });
    rerender();

    await waitFor(() =>
      expect(result.current).toMatchObject({ status: "loaded", sessions: [{ displayName: "Alicia" }, { displayName: "Bob" }] }),
    );
  });

  it("現在のセッションを確認している間は、一覧を読まない", () => {
    authClientMock.useSession.mockReturnValue({ data: null, isPending: true });

    const { result } = renderHook(() => useDeviceSessions());

    expect(result.current.status).toBe("loading");
    expect(authClientMock.multiSession.listDeviceSessions).not.toHaveBeenCalled();
  });

  it("一覧の取得に失敗した場合は失敗の状態にする", async () => {
    authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
    authClientMock.multiSession.listDeviceSessions.mockResolvedValue({ data: null, error: { status: 500 } });

    const { result } = renderHook(() => useDeviceSessions());

    await waitFor(() => expect(result.current.status).toBe("failed"));
  });
});
