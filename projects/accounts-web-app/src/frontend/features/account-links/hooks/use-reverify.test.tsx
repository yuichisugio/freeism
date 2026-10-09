// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BffError } from "../../../lib/api-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { createLinkedAccount } from "../lib/account-links-fixtures";
import { useReverify } from "./use-reverify";

const account = createLinkedAccount({
  id: "eac_1",
  verificationStatus: "unverified",
  primaryUrl: "https://qiita.com/hanako",
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useReverify", () => {
  it("行の主URLを「検証する」と同じ要求で送り、一覧を再取得する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      dataResponse({
        externalAccountId: "eac_1",
        status: "unverified",
        link: { result: "not_verified", failureCode: "LINK_NOT_FOUND", evidenceUrl: null },
        dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onVerified = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useReverify({ onVerified }));

    await act(() => result.current.reverify(account));

    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/external-urls");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://qiita.com/hanako", mode: "verify" });
    expect(onVerified).toHaveBeenCalledOnce();
    expect(result.current.pendingAccountId).toBeNull();
  });

  it("拒否された場合は、その行の失敗として保持し、一覧を再取得しない", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => problemResponse(429, "RATE_LIMITED")));
    const onVerified = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useReverify({ onVerified }));

    await act(() => result.current.reverify(account));

    expect(result.current.failure).toEqual({ accountId: "eac_1", error: expect.any(BffError) });
    expect((result.current.failure as { error: BffError }).error.code).toBe("RATE_LIMITED");
    expect(onVerified).not.toHaveBeenCalled();
  });
});
