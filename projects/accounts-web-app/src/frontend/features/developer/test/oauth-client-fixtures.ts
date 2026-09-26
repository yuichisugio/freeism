import { vi } from "vitest";

import type { OAuthClientDetail } from "../../../../shared/schemas/oauth-client-schema";

/**
 * 開発者向け画面のテストで使うクライアントとBFFのモック。
 */

// --------------------------------------------------
// クライアント
// --------------------------------------------------

/**
 * 登録済みクライアント1件を作る。
 */
export function buildClient(index: number): OAuthClientDetail {
  return {
    clientId: `client-${index}`,
    name: `App ${index}`,
    uri: null,
    description: null,
    redirectUris: [`https://app${index}.example/callback`],
    jwks: { keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y" }] },
  };
}

export const validJwksText = JSON.stringify({ keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y" }] });

// --------------------------------------------------
// BFF
// --------------------------------------------------

type BffRoute = (request: { method: string; url: string; body: unknown }) => Response | undefined;

/**
 * `fetch`をモックし、呼出しを`route`へ渡す。
 * `route`が応答を返さない呼出しはテストの不備として失敗させる。
 */
export function stubBff(route: BffRoute) {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const method = init?.method ?? "GET";
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const response = route({ method, url, body });
    if (response === undefined) throw new Error(`Unexpected request: ${method} ${url}`);
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
