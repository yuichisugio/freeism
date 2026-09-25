import * as v from "valibot";

import { displayNameMaxLength } from "../constants";

/**
 * Accountsプロフィールの入力と応答。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

/**
 * Accountsの表示名。
 * 前後の空白を除いて1文字以上、見た目の文字数で50文字までとする。
 */
export const displayNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.maxGraphemes(displayNameMaxLength),
);

/**
 * `PATCH /api/profile`の入力。
 */
export const profileSchema = v.strictObject({
  displayName: displayNameSchema,
});

/**
 * `GET /api/me`・`PATCH /api/profile`の`data`。
 * `profileUrl`は本人の公開プロフィールURL（DNS TXTの値を兼ねる）。
 */
export const meSchema = v.object({
  accountsUserId: v.string(),
  displayName: v.string(),
  profileUrl: v.string(),
});

export type Me = v.InferOutput<typeof meSchema>;
