import { decodeBase64Url, encodeBase64Url } from "../../src/backend/accounts/base64url";
import externalAccountsFixture from "../fixtures/accounts/external-accounts.json";
import protectedResourceFixture from "../fixtures/accounts/oauth-protected-resource.json";
import openIdConfigurationFixture from "../fixtures/accounts/openid-configuration.json";

/**
 * テスト用のAccounts。
 * Accountsの契約テスト（`projects/accounts-web-app/test/contract/points-client.worker.test.ts`）と同じ手順・応答形を、`fetch`の差し替え先として返す。
 * 受け取った要求のclient assertion・DPoP proof・Access Tokenを検査し、Points側の署名や値の誤りを要求の失敗として返す。
 * Web APIだけを使い、Node.jsの単体テストとWorkersの結合テストの両方で使う。
 * @see ../../../accounts-web-app/test/contract/points-client.worker.test.ts
 * @see ../../../accounts-web-app/src/shared/schemas/resource-api-schema.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * fixtureの接続先origin。
 * 別のoriginで作る場合は、fixture内のこの値を置き換える。
 */
export const fakeAccountsFixtureOrigin = "https://accounts.example.test";

/**
 * 受け取った要求の記録。
 */
export type FakeAccountsRequest = {
  method: string;
  url: string;
  headers: Headers;
  body: string;
};

/**
 * 照合の1件の結果（`index`と`identifier`はテスト用Accountsが補う）。
 */
export type FakeResolveResult =
  | { status: "matched"; accountsUserId: string }
  | { status: "no_match" }
  | {
      status: "invalid_input";
      errors: { code: string; message: string; path: (string | number)[] }[];
    };

/**
 * 認可コードの発行条件。
 * `idTokenClaims`で上書きした値や、登録外の鍵での署名によって、不正なID Tokenを返せる。
 */
export type FakeAuthorizationCodeInput = {
  clientId: string;
  sub: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
  idTokenClaims?: Record<string, unknown>;
  signIdTokenWithUnknownKey?: boolean;
};

export type FakeAccounts = {
  origin: string;
  /** Pointsの`accountsFetch`へ渡す`fetch`。 */
  fetch: typeof fetch;
  /** 受け取った要求（`interceptNext`で差し替えた要求を含む）。 */
  requests: FakeAccountsRequest[];
  /** 開発者向け画面でのクライアント登録に相当する。 */
  registerClient(clientId: string, publicJwks: { keys: JsonWebKey[] }): void;
  /** 利用者が同意画面で同意した後の認可コードを発行する。 */
  issueCode(input: FakeAuthorizationCodeInput): string;
  /** 一覧取得の応答。`null`は404（対象なし・同意OFF・ban・退会）。既定は`null`。 */
  setList(handler: (accountsUserId: string) => unknown[] | null): void;
  /** 照合の1件ごとの結果。既定は`no_match`。 */
  setResolve(handler: (identifier: unknown, index: number) => FakeResolveResult): void;
  /** 次の1回だけ、指定したpathへの要求に代わりの応答（または通信失敗）を返す。 */
  interceptNext(pathname: string, interception: Response | "network"): void;
  /** 発行済みのAccess Tokenをすべて無効にする（クライアントの削除・鍵の更新に相当）。 */
  revokeAccessTokens(): void;
  /** DPoP proofに`nonce`を要求する（RFC 9449 §8・§9）。 */
  requireDpopNonce(nonce: string): void;
};

type IssuedAccessToken = { jkt: string; kind: "client_credentials" | "authorization_code" };
type IssuedCode = FakeAuthorizationCodeInput;
type JwsParts = { header: Record<string, unknown>; payload: Record<string, unknown> };

const resolveIdentifierLimit = 1000;
const accessTokenLifetimeSeconds = 900;

// --------------------------------------------------
// JWS
// --------------------------------------------------

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(part))) as Record<string, unknown>;
}

async function signJws(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: CryptoKey,
) {
  const input = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(input));
  return `${input}.${encodeBase64Url(new Uint8Array(signature))}`;
}

/**
 * EdDSAのJWSを検証して、headerとpayloadを返す。
 * @returns 形式・署名が不正な場合は`null`
 */
async function verifyJws(jws: string, publicJwk: JsonWebKey): Promise<JwsParts | null> {
  const [header, payload, signature] = jws.split(".");
  if (header === undefined || payload === undefined || signature === undefined) return null;
  const { kty, crv, x } = publicJwk;
  const key = await crypto.subtle.importKey("jwk", { kty, crv, x }, "Ed25519", false, ["verify"]);
  const isValid = await crypto.subtle.verify(
    "Ed25519",
    key,
    decodeBase64Url(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return isValid ? { header: decodeJson(header), payload: decodeJson(payload) } : null;
}

async function calculateJwkThumbprint({ crv, kty, x }: JsonWebKey): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify({ crv, kty, x })),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

async function generateSigningKey(kid: string) {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const { kty, crv, x } = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return { privateKey: keyPair.privateKey, publicJwk: { alg: "EdDSA", crv, kty, x, kid } };
}

// --------------------------------------------------
// 応答
// --------------------------------------------------

function oauthError(status: number, error: string, headers: Record<string, string> = {}) {
  return Response.json({ error, error_description: error }, { status, headers });
}

function resourceError(status: number, code: string, path: (string | number)[] | null = null) {
  const headers: Record<string, string> =
    status === 401 ? { "WWW-Authenticate": 'DPoP error="invalid_token", algs="EdDSA"' } : {};
  return Response.json({ errors: [{ code, message: code, path }] }, { status, headers });
}

function replaceOrigin<T>(fixture: T, origin: string): T {
  return JSON.parse(JSON.stringify(fixture).replaceAll(fakeAccountsFixtureOrigin, origin)) as T;
}

/**
 * Accountsの仕様例の一覧取得（`external-accounts.json`）の外部アカウント。
 */
export function sampleExternalAccounts(): unknown[] {
  return structuredClone(externalAccountsFixture.externalAccounts);
}

// --------------------------------------------------
// テスト用Accounts
// --------------------------------------------------

/**
 * テスト用のAccountsを作る。
 */
export async function createFakeAccounts({
  origin = fakeAccountsFixtureOrigin,
}: { origin?: string } = {}): Promise<FakeAccounts> {
  const tokenEndpoint = `${origin}/api/auth/oauth2/token`;
  const resourceIdentifier = `${origin}/api/v1`;
  const signingKey = await generateSigningKey("fake-accounts-signing-key");
  const unknownSigningKey = await generateSigningKey(signingKey.publicJwk.kid);

  const requests: FakeAccountsRequest[] = [];
  const clients = new Map<string, JsonWebKey[]>();
  const codes = new Map<string, IssuedCode>();
  const accessTokens = new Map<string, IssuedAccessToken>();
  const usedJtis = new Set<string>();
  const interceptions = new Map<string, Response | "network">();
  let listHandler: (accountsUserId: string) => unknown[] | null = () => null;
  let resolveHandler: (identifier: unknown, index: number) => FakeResolveResult = () => ({
    status: "no_match",
  });
  let requiredDpopNonce: string | null = null;

  /**
   * DPoP proofを検査する。
   * @returns proofの公開鍵のthumbprint。不正な場合は`null`
   */
  async function verifyDpopProof(
    request: Request,
    accessToken: string | null,
  ): Promise<{ jkt: string } | { nonceRequired: true } | null> {
    const proof = request.headers.get("DPoP");
    if (proof === null) return null;
    const [encodedHeader = ""] = proof.split(".");
    const header = decodeJson(encodedHeader);
    const jwk = header.jwk as JsonWebKey | undefined;
    if (header.typ !== "dpop+jwt" || header.alg !== "EdDSA" || jwk === undefined || "d" in jwk) {
      return null;
    }
    const verified = await verifyJws(proof, jwk);
    if (verified === null) return null;
    const { payload } = verified;
    const url = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.htm !== request.method ||
      payload.htu !== `${url.origin}${url.pathname}` ||
      typeof payload.jti !== "string" ||
      usedJtis.has(payload.jti) ||
      typeof payload.iat !== "number" ||
      Math.abs(now - payload.iat) > 60
    ) {
      return null;
    }
    if (accessToken !== null && payload.ath !== (await sha256Base64Url(accessToken))) return null;
    if (requiredDpopNonce !== null && payload.nonce !== requiredDpopNonce) {
      return { nonceRequired: true };
    }
    usedJtis.add(payload.jti);
    return { jkt: await calculateJwkThumbprint(jwk) };
  }

  /**
   * `private_key_jwt`のclient assertionを検査する。
   * @returns 認証したclient ID。不正な場合は`null`
   */
  async function authenticateClient(form: URLSearchParams): Promise<string | null> {
    const assertion = form.get("client_assertion");
    if (
      form.get("client_assertion_type") !==
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer" ||
      assertion === null
    ) {
      return null;
    }
    const [encodedHeader = "", encodedPayload = ""] = assertion.split(".");
    const header = decodeJson(encodedHeader);
    const clientId = decodeJson(encodedPayload).iss;
    const jwk = clients
      .get(String(clientId))
      ?.find((key) => (key as { kid?: string }).kid === header.kid);
    if (header.alg !== "EdDSA" || jwk === undefined) return null;
    const verified = await verifyJws(assertion, jwk);
    if (verified === null) return null;
    const { payload } = verified;
    const now = Math.floor(Date.now() / 1000);
    if (
      payload.sub !== clientId ||
      (payload.aud !== tokenEndpoint && payload.aud !== origin) ||
      typeof payload.exp !== "number" ||
      payload.exp <= now ||
      payload.exp - now > 300 ||
      typeof payload.jti !== "string" ||
      usedJtis.has(`client-assertion:${payload.jti}`)
    ) {
      return null;
    }
    usedJtis.add(`client-assertion:${payload.jti}`);
    return String(clientId);
  }

  async function issueIdToken(code: IssuedCode): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const key = code.signIdTokenWithUnknownKey ? unknownSigningKey : signingKey;
    return signJws(
      { alg: "EdDSA", typ: "JWT", kid: signingKey.publicJwk.kid },
      {
        iss: origin,
        sub: code.sub,
        aud: code.clientId,
        nonce: code.nonce,
        iat: now,
        exp: now + 3600,
        ...code.idTokenClaims,
      },
      key.privateKey,
    );
  }

  async function handleToken(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    const dpop = await verifyDpopProof(request, null);
    if (dpop !== null && "nonceRequired" in dpop) {
      return oauthError(400, "use_dpop_nonce", { "DPoP-Nonce": requiredDpopNonce ?? "" });
    }
    if (dpop === null) return oauthError(400, "invalid_dpop_proof");
    const clientId = await authenticateClient(form);
    if (clientId === null) return oauthError(401, "invalid_client");

    const issueAccessToken = (kind: IssuedAccessToken["kind"]) => {
      const accessToken = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      accessTokens.set(accessToken, { jkt: dpop.jkt, kind });
      return accessToken;
    };

    switch (form.get("grant_type")) {
      case "client_credentials": {
        if (form.get("scope") !== "identities:read") return oauthError(400, "invalid_scope");
        if (form.get("resource") !== resourceIdentifier) return oauthError(400, "invalid_target");
        return Response.json({
          access_token: issueAccessToken("client_credentials"),
          token_type: "DPoP",
          expires_in: accessTokenLifetimeSeconds,
          scope: "identities:read",
        });
      }
      case "authorization_code": {
        const code = codes.get(form.get("code") ?? "");
        codes.delete(form.get("code") ?? "");
        const codeVerifier = form.get("code_verifier") ?? "";
        if (
          code === undefined ||
          code.clientId !== clientId ||
          code.redirectUri !== form.get("redirect_uri") ||
          code.codeChallenge !== (await sha256Base64Url(codeVerifier))
        ) {
          return oauthError(400, "invalid_grant");
        }
        return Response.json({
          access_token: issueAccessToken("authorization_code"),
          token_type: "DPoP",
          expires_in: accessTokenLifetimeSeconds,
          scope: "openid",
          id_token: await issueIdToken(code),
        });
      }
      default:
        return oauthError(400, "unsupported_grant_type");
    }
  }

  async function handleResourceApi(request: Request, pathname: string): Promise<Response> {
    const authorization = request.headers.get("Authorization") ?? "";
    const accessToken = authorization.startsWith("DPoP ") ? authorization.slice(5) : "";
    const issued = accessTokens.get(accessToken);
    const dpop = await verifyDpopProof(request, accessToken);
    if (dpop !== null && "nonceRequired" in dpop) {
      return new Response(null, {
        status: 401,
        headers: {
          "WWW-Authenticate": 'DPoP error="use_dpop_nonce", algs="EdDSA"',
          "DPoP-Nonce": requiredDpopNonce ?? "",
        },
      });
    }
    if (issued?.kind !== "client_credentials" || dpop === null || dpop.jkt !== issued.jkt) {
      return resourceError(401, "UNAUTHORIZED");
    }
    if (request.method !== "QUERY") return resourceError(405, "METHOD_NOT_ALLOWED");
    if (request.headers.get("Content-Type") !== "application/json") {
      return resourceError(415, "UNSUPPORTED_MEDIA_TYPE");
    }
    const body = (await request.json()) as Record<string, unknown>;

    if (pathname === "/api/v1/external-accounts") {
      const accountsUserId = String(body.accountsUserId);
      const externalAccounts = listHandler(accountsUserId);
      return externalAccounts === null
        ? resourceError(404, "NOT_FOUND")
        : Response.json({ accountsOrigin: origin, accountsUserId, externalAccounts });
    }

    const identifiers = body.identifiers;
    if (!Array.isArray(identifiers) || identifiers.length > resolveIdentifierLimit) {
      return resourceError(400, "INVALID_VALUE", ["identifiers"]);
    }
    const results = identifiers.map((identifier: unknown, index) => {
      const result = resolveHandler(identifier, index);
      return {
        index,
        identifier,
        status: result.status,
        accountsUserId: result.status === "matched" ? result.accountsUserId : null,
        errors: result.status === "invalid_input" ? result.errors : [],
      };
    });
    const hasInvalidInput = results.some(({ status }) => status === "invalid_input");
    return Response.json(
      { accountsOrigin: origin, results },
      { status: hasInvalidInput ? 400 : 200 },
    );
  }

  async function route(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    switch (`${request.method} ${pathname}`) {
      case "GET /.well-known/openid-configuration":
      case "GET /.well-known/oauth-authorization-server":
        return Response.json(replaceOrigin(openIdConfigurationFixture, origin));
      case "GET /.well-known/oauth-protected-resource/api/v1":
        return Response.json(replaceOrigin(protectedResourceFixture, origin));
      case "GET /api/auth/jwks":
        return Response.json({ keys: [signingKey.publicJwk] });
      case "POST /api/auth/oauth2/token":
        return handleToken(request);
      default:
        return pathname.startsWith("/api/v1/")
          ? handleResourceApi(request, pathname)
          : new Response("Not Found", { status: 404 });
    }
  }

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== origin) throw new TypeError(`Unexpected fetch: ${request.url}`);
    requests.push({
      method: request.method,
      url: request.url,
      headers: new Headers(request.headers),
      body: await request.clone().text(),
    });
    const interception = interceptions.get(url.pathname);
    if (interception !== undefined) {
      interceptions.delete(url.pathname);
      if (interception === "network") throw new TypeError("Network connection lost.");
      return interception;
    }
    return route(request);
  };

  return {
    origin,
    fetch: fakeFetch,
    requests,
    registerClient(clientId, publicJwks) {
      clients.set(clientId, publicJwks.keys);
    },
    issueCode(input) {
      const code = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
      codes.set(code, input);
      return code;
    },
    setList(handler) {
      listHandler = handler;
    },
    setResolve(handler) {
      resolveHandler = handler;
    },
    interceptNext(pathname, interception) {
      interceptions.set(pathname, interception);
    },
    revokeAccessTokens() {
      accessTokens.clear();
    },
    requireDpopNonce(nonce) {
      requiredDpopNonce = nonce;
    },
  };
}
