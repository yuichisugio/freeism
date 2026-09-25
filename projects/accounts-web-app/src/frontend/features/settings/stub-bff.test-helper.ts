import { vi } from "vitest";

import { problemResponse } from "../../test/bff-responses";

/**
 * 「設定」画面のテスト用に、BFFの応答を`"METHOD /path"`ごとに差し替える。
 * 未定義の要求は404の問題詳細を返す。
 */
export function stubBff(handlers: Record<string, () => Response>) {
  const fetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async (path, init) => {
    const key = `${init?.method ?? "GET"} ${path}`;
    const handler = handlers[key];
    return handler ? handler() : problemResponse(404, "NOT_FOUND");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * `"METHOD /path"`の要求で送ったJSONのbodyを返す。
 * 要求が無ければ`undefined`。
 */
export function findRequestBody(fetchMock: ReturnType<typeof stubBff>, key: string): unknown {
  const call = fetchMock.mock.calls.find(([path, init]) => `${init?.method ?? "GET"} ${path}` === key);
  return call === undefined ? undefined : JSON.parse(call[1]?.body as string);
}
