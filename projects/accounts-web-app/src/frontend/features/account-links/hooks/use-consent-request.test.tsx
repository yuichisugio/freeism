// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseConsentRequest, useConsentRequest } from "./use-consent-request";

const consentMock = vi.hoisted(() => vi.fn<(input: { accept: boolean }) => Promise<unknown>>());

vi.mock("../../../lib/auth-client", () => ({
  authClient: { oauth2: { consent: consentMock } },
}));

const now = new Date("2026-09-26T00:00:00Z").getTime();
const signedSearch = {
  client_id: "points",
  redirect_uri: "https://points.example:8443/callback",
  exp: String(now / 1000 + 600),
  sig: "signature",
};

beforeEach(() => {
  vi.useFakeTimers({ now });
  consentMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseConsentRequest", () => {
  it("署名付きクエリから連携先・戻り先のhost・期限を読む", () => {
    expect(parseConsentRequest(signedSearch)).toEqual({
      clientId: "points",
      redirectHost: "points.example:8443",
      expiresAt: now + 600_000,
    });
  });

  it("署名が無いクエリは同意画面として扱わない", () => {
    expect(parseConsentRequest({ client_id: "points" })).toBeNull();
  });
});

describe("useConsentRequest", () => {
  it("期限の時刻を過ぎると失効を示す", () => {
    const { result } = renderHook(() => useConsentRequest(signedSearch));
    expect(result.current.isExpired).toBe(false);

    act(() => {
      vi.advanceTimersByTime(600_000);
    });

    expect(result.current.isExpired).toBe(true);
  });

  it("「同意して戻る」は公開設定の保存に成功した後に同意を送る", async () => {
    consentMock.mockResolvedValue({ data: { redirect: true, url: "https://points.example/callback?code=x" }, error: null });
    const { result } = renderHook(() => useConsentRequest(signedSearch));
    const saveWithConsent = vi.fn<() => Promise<boolean>>(async () => true);

    await act(() => result.current.accept(saveWithConsent));

    expect(saveWithConsent).toHaveBeenCalledOnce();
    expect(consentMock).toHaveBeenCalledWith({ accept: true });
    expect(result.current.isSubmitting).toBe(true);
  });

  it("公開設定の保存に失敗した場合は同意を送らない", async () => {
    const { result } = renderHook(() => useConsentRequest(signedSearch));

    await act(() => result.current.accept(async () => false));

    expect(consentMock).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("「同意しない」は保存せずに拒否を送り、失敗したらやり直しの案内に切り替える", async () => {
    consentMock.mockResolvedValue({ data: null, error: { status: 400, message: "invalid" } });
    const { result } = renderHook(() => useConsentRequest(signedSearch));

    await act(() => result.current.deny());

    expect(consentMock).toHaveBeenCalledWith({ accept: false });
    expect(result.current.hasFailed).toBe(true);
  });
});

describe("useConsentRequest（期限が遠い場合）", () => {
  it("setTimeoutの上限を超える先の期限でも失効扱いにしない", () => {
    const { result } = renderHook(() => useConsentRequest({ ...signedSearch, exp: String(now / 1000 + 60 * 60 * 24 * 365) }));

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.isExpired).toBe(false);
  });
});
