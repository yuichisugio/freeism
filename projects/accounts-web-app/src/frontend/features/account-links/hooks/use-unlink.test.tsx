// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LinkedVerification } from "../../../../shared/schemas/account-link-schema";
import { BffError } from "../../../lib/api-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { createLinkedAccount } from "../lib/account-links-fixtures";
import { useUnlink } from "./use-unlink";

const verification: LinkedVerification = {
  id: "evf 1",
  method: "dns_txt",
  verifiedAt: "2026-09-01T00:00:00Z",
  evidence: "_accounts.example.org",
  identifiers: [],
};
const account = createLinkedAccount({ id: "eac_1", verifications: [verification] });

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

  it("証明ごとの解除は対象の証明を指定し、成功後に確認を閉じて再取得する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => dataResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const onUnlinked = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useUnlink({ onUnlinked }));

    act(() => result.current.request({ kind: "verification", account, verification }));
    await act(() => result.current.confirm());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/external-accounts/eac_1/verifications/evf%201",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(result.current.target).toBeNull();
    expect(result.current.doneKind).toBe("verification");
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
