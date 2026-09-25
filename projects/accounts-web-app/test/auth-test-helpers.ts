import { env, waitUntil } from "cloudflare:workers";
import { setTokenUtil } from "better-auth/oauth2";
import type { TestHelpers } from "better-auth/plugins";

import { createAuth } from "../src/backend/auth/create-auth";
import type { AuthContext } from "../src/backend/auth/read-oauth-profile";

/**
 * `testUtils`を有効にした、Workers結合テスト用のBetter Auth。
 */
export const testAuth = createAuth(env, { waitUntil, enableTestUtils: true });

/**
 * Better Authの内部コンテキストと`testUtils`のヘルパーを取得する。
 * `testUtils`は条件付きで追加するため、ヘルパーの型をここで補う。
 */
export async function getTestAuthContext() {
  const context = await testAuth.$context;
  return Object.assign(context, { test: (context as unknown as { test: TestHelpers }).test });
}

/**
 * 署名を検証しない経路（保存済みID Tokenのclaims読取）で使う、未署名のID Tokenを作る。
 */
export function createUnsignedIdToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.signature`;
}

/**
 * 標準の保存処理と同じ方法でOAuth tokenを暗号化する。
 */
export async function encryptTestOAuthToken(token: string): Promise<string | undefined> {
  // `$context`は設定値で型付けされ、Better Authの汎用の`AuthContext`へ代入できないため変換する。
  const context = (await testAuth.$context) as unknown as AuthContext;
  return (await setTokenUtil(token, context)) ?? undefined;
}
