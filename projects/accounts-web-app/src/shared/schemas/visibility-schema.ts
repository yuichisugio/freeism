import * as v from "valibot";

/**
 * `PUT /api/visibility`の入力。
 * 一般公開・情報提供同意・外部アカウント別の公開選択を1回でまとめて保存する。
 * 同意ONのクライアントに証明済みの選択が無い場合、バックエンドは全体を400 `CONSENT_REQUIRES_VERIFIED_ACCOUNT`（`errors[].path`は`["clients", i]`）にする。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */
export const visibilitySchema = v.strictObject({
  accounts: v.array(
    v.strictObject({
      externalAccountId: v.pipe(v.string(), v.nonEmpty()),
      isPublic: v.boolean(),
    }),
  ),
  clients: v.array(
    v.strictObject({
      clientId: v.pipe(v.string(), v.nonEmpty()),
      consented: v.boolean(),
      visibleAccountIds: v.array(v.pipe(v.string(), v.nonEmpty())),
    }),
  ),
});

export type VisibilityInput = v.InferInput<typeof visibilitySchema>;
