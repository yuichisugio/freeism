import * as v from "valibot";

import { identifierValueMaxBytes, urlMaxBytes } from "../constants";
import { providerIds } from "../providers";

/**
 * 外部アカウントの識別子（API・バックアップJSONで共通の形）。
 * 各形式は定義された項目だけを受け付ける。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

const identifierValueSchema = v.pipe(v.string(), v.nonEmpty(), v.maxBytes(identifierValueMaxBytes));

/**
 * HTTPSの絶対URL。
 * 正規化と取得先の検査はバックエンドが行う。
 */
export const httpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith("https://"),
  v.maxBytes(urlMaxBytes),
);

export const urlIdentifierSchema = v.strictObject({
  type: v.literal("url"),
  url: httpsUrlSchema,
});

export const providerAccountIdentifierSchema = v.strictObject({
  type: v.literal("provider_account"),
  provider: v.picklist(providerIds),
  accountId: identifierValueSchema,
});

export const providerUsernameIdentifierSchema = v.strictObject({
  type: v.literal("provider_username"),
  provider: v.picklist(providerIds),
  username: identifierValueSchema,
});

/**
 * 外部アカウントの識別子。
 */
export const externalIdentifierSchema = v.variant("type", [
  urlIdentifierSchema,
  providerAccountIdentifierSchema,
  providerUsernameIdentifierSchema,
]);

export type ExternalIdentifier = v.InferOutput<typeof externalIdentifierSchema>;
