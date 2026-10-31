// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { useExternalUrlForm } from "./use-external-url-form";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useExternalUrlForm", () => {
  it("URLが空の場合は送信せずに入力不備を示す", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useExternalUrlForm({ onSaved: vi.fn<() => Promise<void>>(async () => {}) }));

    await act(() => result.current.submit("verify"));

    expect(result.current.validationError).toBe("required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("「保存して検証する」は結果を保持し、入力を空にして一覧を再取得する", async () => {
    const verifyResult = {
      externalAccountId: "eac_1",
      status: "unverified",
      link: { result: "not_verified", failureCode: "LINK_NOT_FOUND", evidenceUrl: null },
      dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
    };
    const fetchMock = vi.fn<typeof fetch>(async () => dataResponse(verifyResult));
    vi.stubGlobal("fetch", fetchMock);
    const onSaved = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useExternalUrlForm({ onSaved }));

    act(() => result.current.setUrl("  https://example.org/about  "));
    await act(() => result.current.submit("verify"));

    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/external-urls");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.org/about", mode: "verify" });
    expect(result.current.outcome).toEqual({ mode: "verify", result: verifyResult });
    expect(result.current.url).toBe("");
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("未登録URLの検証が不成立で登録されなかった場合は、入力を保ち一覧を再取得しない", async () => {
    const verifyResult = {
      externalAccountId: null,
      status: "unverified",
      link: { result: "not_verified", failureCode: "LINK_NOT_FOUND", evidenceUrl: null },
      dns: { result: "not_verified", failureCode: "TXT_NOT_FOUND" },
    };
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => dataResponse(verifyResult)));
    const onSaved = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useExternalUrlForm({ onSaved }));

    act(() => result.current.setUrl("https://example.org/about"));
    await act(() => result.current.submit("verify"));

    expect(result.current.outcome).toEqual({ mode: "verify", result: verifyResult });
    expect(result.current.url).toBe("https://example.org/about");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("「未検証で保存」の結果を保持する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => dataResponse({ externalAccountId: "eac_1", created: false })));
    const { result } = renderHook(() => useExternalUrlForm({ onSaved: vi.fn<() => Promise<void>>(async () => {}) }));

    act(() => result.current.setUrl("https://example.org/"));
    await act(() => result.current.submit("unverified"));

    expect(result.current.outcome).toEqual({ mode: "unverified", result: { externalAccountId: "eac_1", created: false } });
  });

  it("バックエンドのURL入力の不備をコードで示し、入力を保つ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        problemResponse(400, "INVALID_VALUE", [{ code: "HOST_NOT_ALLOWED", message: "Host is not allowed.", path: ["url"] }]),
      ),
    );
    const onSaved = vi.fn<() => Promise<void>>(async () => {});
    const { result } = renderHook(() => useExternalUrlForm({ onSaved }));

    act(() => result.current.setUrl("https://localhost/"));
    await act(() => result.current.submit("verify"));

    expect(result.current.urlInputErrorCode).toBe("HOST_NOT_ALLOWED");
    expect(result.current.url).toBe("https://localhost/");
    expect(onSaved).not.toHaveBeenCalled();

    act(() => result.current.setUrl("https://example.org/"));

    expect(result.current.error).toBeNull();
    expect(result.current.urlInputErrorCode).toBeNull();
  });
});
