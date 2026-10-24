import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";

import {
  toProblemIssue,
  type ProblemDetails,
  type ProblemIssue,
} from "../shared/schemas/problem-details-schema";

/**
 * BFF（`/api/*`）の応答の組立て。
 * 成功は`{ data }`、失敗はRFC 9457の`application/problem+json`に機械判定用の`code`と入力不備の`errors`を加える。
 * 本人の情報を返すため、どちらも`Cache-Control: private, no-store`を付ける。
 * @see ../../../../docs/web-app/v0.2/naming-convention.md
 * @see ../shared/schemas/problem-details-schema.ts
 */

// --------------------------------------------------
// 失敗
// --------------------------------------------------

/**
 * ユースケース・ミドルウェアが投げる、BFFの失敗応答へ変換できるエラー。
 * `detail`はRFC 9457の`detail`（英語の補足説明）。
 */
export class ProblemError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    readonly issues?: ProblemIssue[],
    readonly detail?: string,
  ) {
    super(code);
    this.name = "ProblemError";
  }
}

/**
 * RFC 9457の失敗応答を返す。
 * `type`は問題の種類ごとの文書を持たないため`about:blank`とし、`title`には`code`を入れる。
 */
export function problemResponse(c: Context, error: ProblemError): Response {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: error.code,
    status: error.status,
    code: error.code,
    ...(error.detail === undefined ? {} : { detail: error.detail }),
    ...(error.issues === undefined ? {} : { errors: error.issues }),
  };
  return c.json(problem, error.status, {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/problem+json",
  });
}

/**
 * BFFのルートの`onError`。
 * `ProblemError`は対応する失敗応答にし、それ以外の例外はログへ残して500にする。
 */
export function handleBffError(error: Error, c: Context): Response {
  if (error instanceof ProblemError) return problemResponse(c, error);

  console.error(JSON.stringify({ event: "bff_error", errorName: error.name }));
  return problemResponse(c, new ProblemError(500, "INTERNAL_ERROR"));
}

// --------------------------------------------------
// 入力の検査
// --------------------------------------------------

/**
 * 要求bodyをJSONとして読み、共有schemaで検査した値を返す。
 * @throws {ProblemError} JSONとして読めない場合は400 `INVALID_JSON`、schemaに合わない場合は400 `INVALID_VALUE`と項目ごとの`errors`。
 */
export async function parseJsonBody<TSchema extends v.GenericSchema>(
  c: Context,
  schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ProblemError(400, "INVALID_JSON");
  }

  const parsed = v.safeParse(schema, body);
  if (!parsed.success) {
    throw new ProblemError(400, "INVALID_VALUE", parsed.issues.map(toProblemIssue));
  }
  return parsed.output;
}

// --------------------------------------------------
// 成功
// --------------------------------------------------

/**
 * 成功応答`{ data }`を返す。
 */
export function dataResponse<TData>(c: Context, data: TData) {
  return c.json({ data }, 200, { "Cache-Control": "private, no-store" });
}
