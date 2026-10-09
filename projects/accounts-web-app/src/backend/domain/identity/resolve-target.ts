import type { ResolveIdentifier } from "../../../shared/schemas/resource-api-schema";
import { normalizeUrl, type NormalizeUrlErrorCode } from "../verification/normalize-url";
import type { IdentifierKey } from "./identifier-key";
import { normalizeProviderUsername } from "./providers";
import { buildUrlIdentifierKey } from "./url-identifier-keys";

/**
 * 照合APIの入力1件を、保存済みの識別子キーまたはAccountsユーザーIDの照合対象へ変換する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./resolve-target.test.ts
 */

/**
 * 照合対象。
 * 外部の識別子は保存時と同じキー（`issuer`は常に空文字）で照合し、AccountsユーザーIDは存在と同意だけを確認する。
 */
export type ResolveTarget =
  | { kind: "identifier"; key: Pick<IdentifierKey, "kind" | "provider" | "value"> }
  | { kind: "accounts_user"; accountsUserId: string };

/**
 * 変換結果。
 * 失敗の`path`は入力1件の中の位置で、呼出し側が`["identifiers", index]`を前に付ける。
 */
export type ResolveTargetResult =
  | { ok: true; target: ResolveTarget }
  | { ok: false; error: { code: "INVALID_VALUE"; message: string; path: string[] } };

/**
 * URLの受付制約に違反した理由ごとの説明（英語）。
 */
const urlErrorMessages: Record<NormalizeUrlErrorCode, string> = {
  INVALID_URL: "url must be an absolute URL.",
  UNSUPPORTED_SCHEME: "url must use https.",
  TRAILING_DOT_HOST: "url host must not end with a dot.",
  PORT_NOT_ALLOWED: "url must not include a port.",
  USERINFO_NOT_ALLOWED: "url must not include userinfo.",
  HOST_NOT_ALLOWED: "url host must be a public domain name.",
  VALUE_TOO_LONG: "url must be at most 2048 bytes after normalization.",
};

/**
 * 形式を検査済みの照合入力1件を照合対象へ変換する。
 * URLには登録と同じ正規化と受付制約を適用し、ユーザー名にはProvider表の正規化規則を適用する。
 */
export function buildResolveTarget(identifier: ResolveIdentifier): ResolveTargetResult {
  switch (identifier.type) {
    case "url": {
      const normalized = normalizeUrl(identifier.url);
      if (!normalized.ok) {
        return {
          ok: false,
          error: {
            code: "INVALID_VALUE",
            message: urlErrorMessages[normalized.code],
            path: ["url"],
          },
        };
      }
      const { kind, provider, value } = buildUrlIdentifierKey(normalized.url);
      return { ok: true, target: { kind: "identifier", key: { kind, provider, value } } };
    }
    case "provider_account":
      return {
        ok: true,
        target: {
          kind: "identifier",
          key: {
            kind: "provider_account",
            provider: identifier.provider,
            value: identifier.accountId,
          },
        },
      };
    case "provider_username":
      return {
        ok: true,
        target: {
          kind: "identifier",
          key: {
            kind: "provider_username",
            provider: identifier.provider,
            value: normalizeProviderUsername(identifier.provider, identifier.username),
          },
        },
      };
    case "accounts_user":
      return {
        ok: true,
        target: { kind: "accounts_user", accountsUserId: identifier.accountsUserId },
      };
  }
}
