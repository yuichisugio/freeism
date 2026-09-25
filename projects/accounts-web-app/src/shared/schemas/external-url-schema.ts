import * as v from "valibot";

import { urlMaxBytes } from "../constants";
import { verificationFailureCodeSchema, verificationResultSchema, verificationStatusSchema } from "./verification-schema";

/**
 * `POST /api/external-urls`の入力と応答。
 * URLの構文・取得先の安全性の検査と正規化はバックエンドが行い、不備は400の`errors[].code`（`INVALID_URL`など）で返す。
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 */

/**
 * `verify`は「保存して検証する」、`unverified`は「未検証で保存」。
 */
export const externalUrlModeSchema = v.picklist(["verify", "unverified"]);

export const externalUrlSchema = v.strictObject({
  url: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxBytes(urlMaxBytes)),
  mode: externalUrlModeSchema,
});

/**
 * 1つの方法の試行結果。
 */
export const verificationAttemptSchema = v.object({
  result: verificationResultSchema,
  failureCode: v.nullable(verificationFailureCodeSchema),
});

/**
 * `mode: "verify"`の`data`。
 * リンク証明が成立した場合、DNS TXTは試行しないため`dns`は`null`。
 */
export const verifyUrlResultSchema = v.object({
  externalAccountId: v.string(),
  status: verificationStatusSchema,
  link: v.object({
    ...verificationAttemptSchema.entries,
    evidenceUrl: v.nullable(v.string()),
  }),
  dns: v.nullable(verificationAttemptSchema),
});

/**
 * `mode: "unverified"`の`data`。
 * 既に登録済みのURLは変更せず`created: false`を返す。
 */
export const saveUnverifiedUrlResultSchema = v.object({
  externalAccountId: v.string(),
  created: v.boolean(),
});

export type ExternalUrlMode = v.InferOutput<typeof externalUrlModeSchema>;
export type ExternalUrlInput = v.InferInput<typeof externalUrlSchema>;
export type VerificationAttempt = v.InferOutput<typeof verificationAttemptSchema>;
export type VerifyUrlResult = v.InferOutput<typeof verifyUrlResultSchema>;
export type SaveUnverifiedUrlResult = v.InferOutput<typeof saveUnverifiedUrlResultSchema>;
