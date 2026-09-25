import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";

import { toProblemIssue } from "../shared/schemas/problem-details-schema";
import type { ResourceApiError } from "../shared/schemas/resource-api-schema";

/**
 * Accounts資源API（`/api/v1/*`）の応答の組立て。
 * 主仕様「APIの具体案」を外部契約とし、要求全体のエラーは最上位の`errors`配列で返す。
 * BFFのRFC 9457（命名規則6章）とは異なる形だが、連携サービスとの契約を優先する例外とする。
 * 利用者ごとの提供内容を返すため、どの応答も`Cache-Control: no-store`にする。
 * @see ../../docs/specification/v0.1/main.ja.md
 * @see ../../../../docs/web-app/v0.2/naming-convention.md
 * @see ./routes/resource-api-routes.worker.test.ts
 */

const noStoreHeaders = { "Cache-Control": "no-store" } as const;

// --------------------------------------------------
// 失敗
// --------------------------------------------------

/**
 * 要求全体を失敗させるエラー。
 * `headers`は401・403の`WWW-Authenticate`など、応答へ付けるヘッダー。
 */
export class ResourceApiRequestError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly errors: ResourceApiError[],
    readonly headers: Record<string, string> = {},
  ) {
    super(errors[0]?.code ?? "INTERNAL_ERROR");
    this.name = "ResourceApiRequestError";
  }
}

/**
 * 特定の入力項目を指せない要求全体のエラーを1件だけ持つ失敗を作る。
 */
export function requestError(
  status: ContentfulStatusCode,
  code: string,
  message: string,
  headers?: Record<string, string>,
): ResourceApiRequestError {
  return new ResourceApiRequestError(status, [{ code, message, path: null }], headers);
}

/**
 * 要求全体の失敗応答を返す。
 */
export function resourceApiErrorResponse(c: Context, error: ResourceApiRequestError): Response {
  return c.json({ errors: error.errors }, error.status, { ...noStoreHeaders, ...error.headers });
}

/**
 * 資源APIのルートの`onError`。
 * 想定外の例外は種類だけをログへ残し、500 `INTERNAL_ERROR`にする。
 */
export function handleResourceApiError(error: Error, c: Context): Response {
  if (error instanceof ResourceApiRequestError) return resourceApiErrorResponse(c, error);

  console.error(JSON.stringify({ event: "resource_api_error", errorName: error.name }));
  return resourceApiErrorResponse(c, requestError(500, "INTERNAL_ERROR", "Internal server error."));
}

// --------------------------------------------------
// 入力の検査
// --------------------------------------------------

/**
 * 要求bodyをJSONとして読み、schemaで要求全体の形式を検査した値を返す。
 * `Content-Type`と容量は`requireJsonBody`で先に検査する。
 * @throws {ResourceApiRequestError} JSONとして読めない場合は400 `INVALID_JSON`、形式の不備は400と項目ごとの`errors`。
 */
export async function parseResourceApiBody<TSchema extends v.GenericSchema>(
  c: Context,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw requestError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = v.safeParse(schema, body);
  if (!parsed.success) {
    throw new ResourceApiRequestError(400, parsed.issues.map(toProblemIssue));
  }
  return parsed.output;
}

// --------------------------------------------------
// 成功
// --------------------------------------------------

/**
 * 成功応答、または入力ごとの不備を含む照合結果（HTTP 400）を返す。
 */
export function resourceApiResponse<TBody>(c: Context, body: TBody, status: 200 | 400 = 200) {
  return c.json(body, status, noStoreHeaders);
}
