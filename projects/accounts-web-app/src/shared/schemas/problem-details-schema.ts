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

/**
 * valibotの不備を、`MISSING_REQUIRED_FIELD`・`UNKNOWN_FIELD`・`INVALID_TYPE`・`INVALID_VALUE`に分類した不備1件にする。
 * `path`は要求bodyの最上位からの位置とする。
 * バックエンドの応答と画面の送信前の検査で同じ分類にするため、両方がこの関数を使う。
 */
export function toProblemIssue(issue: v.GenericIssue): ProblemIssue {
  return {
    code: classifyIssue(issue),
    message: issue.message,
    path: issue.path?.map((item) => item.key as string | number) ?? null,
  };
}

/**
 * valibotの不備の種類を分類する。
 */
function classifyIssue(issue: v.GenericIssue): string {
  if (issue.kind === "validation") return "INVALID_VALUE";
  if (issue.type === "strict_object" && issue.expected === "never") return "UNKNOWN_FIELD";
  if (
    (issue.type === "object" || issue.type === "strict_object") &&
    issue.received === "undefined"
  ) {
    return "MISSING_REQUIRED_FIELD";
  }
  if (issue.type === "variant") {
    // 判別キーの不足・オブジェクトでない入力・未定義の判別値を区別する。
    if (issue.received === "undefined") return "MISSING_REQUIRED_FIELD";
    if (issue.expected === "Object") return "INVALID_TYPE";
    return "INVALID_VALUE";
  }
  if (issue.type === "literal" || issue.type === "picklist") {
    return "INVALID_VALUE";
  }
  return "INVALID_TYPE";
}

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
