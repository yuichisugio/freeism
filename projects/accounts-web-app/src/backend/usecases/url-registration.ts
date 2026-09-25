import { urlIdentifierLimitPerUser } from "../../shared/constants";
import { createRandomId } from "../db/id";
import type {
  D1ExternalAccountRepository,
  ExternalIdentifierRow,
} from "../db/repositories/d1-external-account-repository";
import { isSameIdentifierKey, type IdentifierKey } from "../domain/identity/identifier-key";
import {
  buildUrlIdentifierKey,
  buildUrlRuleIdentifierKeys,
} from "../domain/identity/url-identifier-keys";
import { classifyServiceUrl } from "../domain/verification/classify-service-url";
import { normalizeUrl } from "../domain/verification/normalize-url";
import { ProblemError } from "../problem-details";

/**
 * 「保存して検証する」「未検証で保存」に共通する、入力URLの検査と登録情報の組立て。
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 * @see ./save-unverified-url.worker.test.ts
 */

/**
 * 入力URLの登録情報。
 */
export type UrlRegistration = {
  /** 正規化した入力URL。 */
  url: string;
  /** 正規化したhost。 */
  host: string;
  /** 入力URLのURL識別子のキー。 */
  urlKey: IdentifierKey;
  /** 登録情報として保存する識別子のキー（入力URLと、プロフィールURLならURL規則のユーザー名）。 */
  keys: IdentifierKey[];
  /** 個別対応サービスのプロフィールURLならProvider識別子。コンテンツURL・汎用Webページは`null`。 */
  service: string | null;
  /** `keys`に一致する本人の識別子行（候補を含む）。 */
  ownIdentifiers: ExternalIdentifierRow[];
  /** 本人が登録済みの入力URLの識別子行。未登録なら`undefined`。 */
  inputIdentifier: ExternalIdentifierRow | undefined;
  /** 入力URLを持つ外部アカウント行のID。未登録なら新しく作る行のID。 */
  externalAccountId: string;
  /** 入力URLを追加した後に、本人がさらに追加できる`url`行の数。 */
  remainingUrlCapacity: number;
};

/**
 * 入力URLの構文と取得先の安全性を検査・正規化し、サービス判定と本人の登録状態を読む。
 * 入力URLが未登録で、本人の`url`行が上限に達している場合は追加を拒否する。
 * @throws {ProblemError} 入力URLの不備（400、`errors[].path`は`["url"]`）と、URL登録数の上限到達（409 `URL_LIMIT_REACHED`）。
 */
export async function readUrlRegistration(
  repository: D1ExternalAccountRepository,
  userId: string,
  inputUrl: string,
): Promise<UrlRegistration> {
  const normalized = normalizeUrl(inputUrl);
  if (!normalized.ok) {
    throw new ProblemError(400, normalized.code, [
      { code: normalized.code, message: "The URL cannot be registered.", path: ["url"] },
    ]);
  }

  const classification = classifyServiceUrl(normalized.url);
  const urlKey = buildUrlIdentifierKey(normalized.url);
  const usernameKeys = buildUrlRuleIdentifierKeys(normalized.url).filter(
    (key) => key.kind === "provider_username",
  );
  const keys = [urlKey, ...usernameKeys];

  const [identifiers, urlIdentifierCount] = await Promise.all([
    repository.findIdentifiersByKeys(userId, keys),
    repository.countUrlIdentifiers(userId),
  ]);
  const ownIdentifiers = identifiers.filter((identifier) => identifier.userId === userId);
  const inputIdentifier = ownIdentifiers.find((identifier) =>
    isSameIdentifierKey(identifier, urlKey),
  );
  if (inputIdentifier === undefined && urlIdentifierCount >= urlIdentifierLimitPerUser) {
    throw new ProblemError(409, "URL_LIMIT_REACHED");
  }

  return {
    url: normalized.url,
    host: normalized.host,
    urlKey,
    keys,
    service: classification.urlType === "profile" ? classification.provider : null,
    ownIdentifiers,
    inputIdentifier,
    externalAccountId: inputIdentifier?.accountId ?? createRandomId("eac_"),
    remainingUrlCapacity:
      urlIdentifierLimitPerUser - urlIdentifierCount - (inputIdentifier === undefined ? 1 : 0),
  };
}

/**
 * 未登録の入力URLについて、登録情報の識別子を候補（`is_active=0`）として追加する行を作る。
 * 本人が別の外部アカウント行で保持しているユーザー名は追加しない。
 * 入力URLが登録済みなら空配列を返す。
 */
export function buildRegistrationIdentifiers(registration: UrlRegistration, userId: string) {
  if (registration.inputIdentifier !== undefined) {
    return [];
  }

  return registration.keys
    .filter(
      (key) =>
        !registration.ownIdentifiers.some((identifier) => isSameIdentifierKey(identifier, key)),
    )
    .map((key) => ({
      ...key,
      id: createRandomId("eid_"),
      accountId: registration.externalAccountId,
      userId,
    }));
}
