// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProviderLink } from "./use-provider-link";

// 応答はテストごとに必要な項目だけを返すため、呼出しの型を緩める。
type AuthClientCall = (...args: unknown[]) => Promise<unknown>;

const linkSocialMock = vi.hoisted(() => vi.fn<AuthClientCall>());
vi.mock("../../../lib/auth-client", () => ({ authClient: { linkSocial: linkSocialMock } }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useProviderLink", () => {
  it("この画面へ戻る指定で追加連携を開始する", async () => {
    linkSocialMock.mockResolvedValue({ data: { url: "https://github.com/login/oauth/authorize", redirect: true }, error: null });
    const { result } = renderHook(() => useProviderLink());

    await act(() => result.current.link("github"));

    expect(linkSocialMock).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/account-links",
      errorCallbackURL: "/account-links",
    });
  });

  it("移動が取り消されて画面に留まっても（未保存の変更の確認で留まるなど）、再度押せる状態に戻す", async () => {
    // 成功時はBetter Authのクライアントが`window.location.href`へ代入し、移動が取り消されてもPromiseは成功として解決する。
    linkSocialMock.mockResolvedValue({ data: { url: "https://github.com/login/oauth/authorize", redirect: true }, error: null });
    const { result } = renderHook(() => useProviderLink());

    await act(() => result.current.link("github"));

    expect(result.current.pendingProvider).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("開始の応答が失敗の場合は、失敗を保持して再度押せる状態に戻す", async () => {
    const error = { status: 400, statusText: "Bad Request" };
    linkSocialMock.mockResolvedValue({ data: null, error });
    const { result } = renderHook(() => useProviderLink());

    await act(() => result.current.link("orcid"));

    expect(result.current.pendingProvider).toBeNull();
    expect(result.current.error).toBe(error);
  });
});
