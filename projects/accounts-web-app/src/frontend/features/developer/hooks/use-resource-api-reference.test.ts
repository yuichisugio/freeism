// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createResourceApiOpenApiDocument } from "../../../../backend/openapi/resource-api-openapi-document";
import { useResourceApiReference } from "./use-resource-api-reference";

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useResourceApiReference", () => {
  it("資源APIのOpenAPI文書を読み込み、操作の要約にする", async () => {
    const fetchMock = stubFetch(
      Response.json(createResourceApiOpenApiDocument("https://accounts.example")),
    );

    const { result } = renderHook(() => useResourceApiReference());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/openapi.json");
  });

  it("失敗応答と想定外の形は失敗の状態にする", async () => {
    stubFetch(new Response("error", { status: 500 }));
    const failed = renderHook(() => useResourceApiReference());
    await waitFor(() => expect(failed.result.current.status).toBe("failed"));

    stubFetch(Response.json({ openapi: "3.2.1" }));
    const invalid = renderHook(() => useResourceApiReference());
    await waitFor(() => expect(invalid.result.current.status).toBe("failed"));
  });
});
