/**
 * Workers結合テストで外部ページの代わりに応答する、`fetch`互換のモックサーバー。
 * 実ネットワークへ出ずに、safe fetchのredirect・期限・容量の扱いを確かめる。
 * @see ./safe-page-fetcher.worker.test.ts
 */

/**
 * URLごとの応答を返す処理。
 */
export type MockPageHandler = (request: Request) => Response | Promise<Response>;

/**
 * URL（完全一致）ごとの処理から、`fetch`互換の関数と受け取った要求の記録を作る。
 * 登録の無いURLには404を返す。
 */
export function createMockServer(handlers: Record<string, MockPageHandler>) {
  const requests: Request[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);
    const handler = handlers[request.url];
    return handler === undefined ? new Response("not found", { status: 404 }) : handler(request);
  };
  return { fetch, requests };
}
