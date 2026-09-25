// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BffError } from "../../../lib/api-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { createLinkedAccount } from "../lib/account-links-fixtures";
import { useUnlink } from "./use-unlink";

const account = createLinkedAccount({ id: "eac_1" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUnlink", () => {
  it("確認前は解除しない", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useUnlink({ onUnlinked: vi.fn<() => Promise<void>>(async () => {}) }));

    await act(() => result.current.confirm());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OAuthだけの解除は対象の認証連携を指定し、成功後に確認を閉じて再取得する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => dataResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const onUnlinked = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useUnlink({ onUnlinked }));

    act(() => result.current.request({ kind: "oauth", account, authAccountId: "acc 1" }));
    await act(() => result.current.confirm());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/external-accounts/eac_1/oauth/acc%201",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result.current.target).toBeNull();
    expect(result.current.isDone).toBe(true);
    expect(onUnlinked).toHaveBeenCalledOnce();
  });

  it("最後のログイン手段として拒否された場合は、確認を開いたまま理由を保持する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => problemResponse(400, "LAST_LOGIN_METHOD")));
    const onUnlinked = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useUnlink({ onUnlinked }));

    act(() => result.current.request({ kind: "account", account }));
    await act(() => result.current.confirm());

    expect(result.current.target).toEqual({ kind: "account", account });
    expect((result.current.error as BffError).code).toBe("LAST_LOGIN_METHOD");
    expect(onUnlinked).not.toHaveBeenCalled();
  });
});
