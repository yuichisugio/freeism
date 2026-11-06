import type { ProviderId } from "../../../shared/providers";
import type { ExternalIdentifier } from "../../../shared/schemas/identifier-schema";
import type { IdentifierKey, IdentifierKind } from "../../domain/identity/identifier-key";
import { normalizeProviderUsername } from "../../domain/identity/providers";
import { buildUrlIdentifierKey } from "../../domain/identity/url-identifier-keys";
import { normalizeUrl } from "../../domain/verification/normalize-url";

/**
 * バックアップJSONの識別子と、保存・照合に使う識別子キーの相互変換。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./plan-backup-restore.test.ts
 */

/**
 * 保存済みの識別子行を、バックアップJSONの識別子の形にする。
 * Provider識別子行の`provider`は、保存時に検査したProvider表の値である。
 */
export function toBackupIdentifier(row: {
  kind: IdentifierKind;
  provider: string;
  value: string;
}): ExternalIdentifier {
  switch (row.kind) {
    case "url":
      return { type: "url", url: row.value };
    case "provider_account":
      return { type: "provider_account", provider: row.provider as ProviderId, accountId: row.value };
    case "provider_username":
      return { type: "provider_username", provider: row.provider as ProviderId, username: row.value };
  }
}

/**
 * バックアップJSONの識別子を識別子キーにする。
 * URLは登録と同じ規則で正規化し、受け付けられないURLは`null`を返す。
 */
export function toIdentifierKey(identifier: ExternalIdentifier): IdentifierKey | null {
  switch (identifier.type) {
    case "url": {
      const normalized = normalizeUrl(identifier.url);
      return normalized.ok ? buildUrlIdentifierKey(normalized.url) : null;
    }
    case "provider_account":
      return {
        kind: "provider_account",
        provider: identifier.provider,
        issuer: "",
        value: identifier.accountId,
        host: null,
      };
    case "provider_username":
      return {
        kind: "provider_username",
        provider: identifier.provider,
        issuer: "",
        value: normalizeProviderUsername(identifier.provider, identifier.username),
        host: null,
      };
  }
}

/**
 * 識別子キーを、同じ識別子で一致する文字列にする（Mapのキー用）。
 */
export function serializeIdentifierKey(key: {
  kind: IdentifierKind;
  provider: string;
  issuer: string;
  value: string;
}): string {
  return JSON.stringify([key.kind, key.provider, key.issuer, key.value]);
}
