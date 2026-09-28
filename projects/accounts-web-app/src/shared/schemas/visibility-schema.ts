import * as v from "valibot";

/**
 * `PUT /api/visibility`の入力。
 * 一般公開と外部アカウント別のクライアント向け公開選択を1回でまとめて保存する。
 * `clients`の各クライアントは提供先として記録し、`visibleAccountIds`でそのクライアントへの公開選択を置き換える。
 * 入力に含めない外部アカウントの一般公開と、含めないクライアントの公開選択は変えない（同意画面は今回のクライアントだけを送る）。
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
      visibleAccountIds: v.array(v.pipe(v.string(), v.nonEmpty())),
    }),
  ),
});

export type VisibilityInput = v.InferInput<typeof visibilitySchema>;
