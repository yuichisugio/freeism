// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLogin } from "./use-login";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const authClientMock = vi.hoisted(() => ({
  signIn: { social: vi.fn<AuthClientCall>() },
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
});

describe("useLogin", () => {
  it.each(["google", "github", "orcid"] as const)(
    "%sのログインは、成功時にアカウント連携へ、失敗時にログイン画面へ戻る指定で開始する",
    async (provider) => {
      authClientMock.signIn.social.mockResolvedValue({ data: { redirect: true, url: "https://example.com" }, error: null });
      const { result } = renderHook(() => useLogin());

      await act(() => result.current.signIn(provider));

      expect(authClientMock.signIn.social).toHaveBeenCalledWith({
        provider,
        callbackURL: "/account-links",
        errorCallbackURL: "/",
      });
      // 成功時はProviderへ移動するため、移動が終わるまで開始中の表示を保つ。
      expect(result.current.pendingProvider).toBe(provider);
      expect(result.current.startFailure).toBeNull();
    },
  );

  it("開始の応答が失敗の場合は、失敗を保持して再度押せる状態に戻す", async () => {
    authClientMock.signIn.social.mockResolvedValue({ data: null, error: { status: 500, statusText: "Error" } });
    const { result } = renderHook(() => useLogin());

    await act(() => result.current.signIn("github"));

    expect(result.current.startFailure).toBe("failed");
    expect(result.current.pendingProvider).toBeNull();
  });

  it("署名付きクエリの期限切れで開始できない場合は、期限切れとして保持して再度押せる状態に戻す", async () => {
    authClientMock.signIn.social.mockResolvedValue({
      data: null,
      error: { status: 400, statusText: "Bad Request", error: "invalid_signature" },
    });
    const { result } = renderHook(() => useLogin());

    await act(() => result.current.signIn("github"));

    expect(result.current.startFailure).toBe("expired");
    expect(result.current.pendingProvider).toBeNull();
  });

  it("通信に失敗した場合も、失敗を保持して再度押せる状態に戻す", async () => {
    authClientMock.signIn.social.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useLogin());

    await act(() => result.current.signIn("google"));

    expect(result.current.startFailure).toBe("failed");
    expect(result.current.pendingProvider).toBeNull();
  });

  it("再度開始すると、前回の失敗の表示を消す", async () => {
    authClientMock.signIn.social.mockResolvedValueOnce({ data: null, error: { status: 500, statusText: "Error" } });
    authClientMock.signIn.social.mockResolvedValueOnce({ data: { redirect: true, url: "https://example.com" }, error: null });
    const { result } = renderHook(() => useLogin());

    await act(() => result.current.signIn("google"));
    await act(() => result.current.signIn("google"));

    expect(result.current.startFailure).toBeNull();
  });

  it("前回のログイン方法を返す", () => {
    authClientMock.getLastUsedLoginMethod.mockReturnValue("orcid");

    const { result } = renderHook(() => useLogin());

    expect(result.current.lastUsedMethod).toBe("orcid");
  });
});
