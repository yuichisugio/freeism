// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLicenses } from "./use-licenses";

/**
 * `fetch`の応答を固定する。
 */
function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLicenses", () => {
  it("ビルド時に出力したライセンス一覧を読み込む", async () => {
    const licenses = [
      { name: "react", version: "19.3.0", identifier: "MIT", text: "MIT License" },
      { name: "no-license-file", version: "1.0.0" },
    ];
    const fetchMock = stubFetch(Response.json(licenses));

    const { result } = renderHook(() => useLicenses());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current).toEqual({ status: "loaded", licenses }));
    expect(fetchMock).toHaveBeenCalledWith("/dependency-open-source-licenses.json");
  });

  it("ファイルが無い（404）場合は、ビルド前であることを示す状態にする", async () => {
    stubFetch(new Response("Not Found", { status: 404 }));

    const { result } = renderHook(() => useLicenses());

    await waitFor(() => expect(result.current.status).toBe("notBuilt"));
  });

  it("内容が想定の形でない場合は失敗の状態にする", async () => {
    stubFetch(Response.json([{ name: "react", version: 19 }]));

    const { result } = renderHook(() => useLicenses());

    await waitFor(() => expect(result.current.status).toBe("failed"));
  });

  it("404以外の失敗応答は失敗の状態にする", async () => {
    stubFetch(new Response("error", { status: 500 }));

    const { result } = renderHook(() => useLicenses());

    await waitFor(() => expect(result.current.status).toBe("failed"));
  });
});
