import * as v from "valibot";

/**
 * BFF（`/api/*`）の応答形式。
 * 成功は`{ data }`、失敗はRFC 9457の`application/problem+json`に機械判定用の`code`と入力不備の`errors`を加える。
 * @see ../../../../../docs/web-app/v0.2/naming-convention.md
 */

// --------------------------------------------------
// 失敗
// --------------------------------------------------

/**
 * 入力不備1件。
 * `path`は要求bodyの最上位から対象項目までの位置で、特定の項目を指せない場合は`null`。
 */
export const problemIssueSchema = v.object({
  code: v.string(),
  message: v.string(),
  path: v.nullable(v.array(v.union([v.string(), v.number()]))),
});

/**
 * RFC 9457の問題詳細。
 */
export const problemDetailsSchema = v.object({
  type: v.string(),
  title: v.string(),
  status: v.number(),
  code: v.string(),
  detail: v.optional(v.string()),
  errors: v.optional(v.array(problemIssueSchema)),
});

export type ProblemIssue = v.InferOutput<typeof problemIssueSchema>;
export type ProblemDetails = v.InferOutput<typeof problemDetailsSchema>;

// --------------------------------------------------
// 成功
// --------------------------------------------------

/**
 * 成功応答`{ data }`のschemaを作る。
 */
export function dataResponseSchema<TData extends v.GenericSchema>(data: TData) {
  return v.object({ data });
}

/**
 * 結果の値を持たない操作（解除・保存・削除）の`data`。
 */
export const okSchema = v.object({ ok: v.literal(true) });
