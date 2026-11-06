/**
 * Workers結合テストのWorkerから外部への通信（`fetch`）を受ける、miniflareの`outboundService`。
 * 認証の初期化で取得するORCIDのOpenID Connect Discoveryだけに固定の文書を返し、ほかの外部通信は502で遮断する。
 * テストごとの外部通信は、テスト内で`fetch`を差し替えて用意する。
 * @see ../vite.config.ts
 * @see ../src/backend/auth/create-auth.ts
 */

// --------------------------------------------------
// ORCIDのDiscovery
// --------------------------------------------------

const orcidDiscoveryUrl = "https://orcid.org/.well-known/openid-configuration";

/**
 * Generic OAuthがORCIDの認可・トークン・userinfo・JWKSのendpointを読むための、固定のDiscovery文書。
 */
const orcidDiscoveryDocument = {
  issuer: "https://orcid.org",
  authorization_endpoint: "https://orcid.org/oauth/authorize",
  token_endpoint: "https://orcid.org/oauth/token",
  userinfo_endpoint: "https://orcid.org/oauth/userinfo",
  jwks_uri: "https://orcid.org/oauth/jwks",
  id_token_signing_alg_values_supported: ["RS256"],
};

// --------------------------------------------------
// outboundService
// --------------------------------------------------

/**
 * Workerからの外部通信に応答する。
 */
export function handleWorkerOutboundRequest(request: Request): Response {
  if (request.url === orcidDiscoveryUrl) {
    return Response.json(orcidDiscoveryDocument);
  }
  return new Response(`Outbound request blocked in worker tests: ${request.url}`, { status: 502 });
}
