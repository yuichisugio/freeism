import * as v from "valibot";

import { dataResponseSchema, problemDetailsSchema } from "../../shared/schemas/problem-details-schema";
import type { ProblemDetails } from "../../shared/schemas/problem-details-schema";

/**
 * BFF（`/api/*`）の呼出し。
 * 成功応答`{ data }`を共有schemaで検査して`data`を返し、失敗はRFC 9457の問題詳細を持つ`BffError`にする。
 * @see ../../../docs/specification/v0.1/main.ja.md
 */

/**
 * BFFの失敗応答。
 * `problem`は応答bodyが問題詳細の形でない場合に`null`。
 */
export class BffError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.title ?? `HTTP ${status}`);
    this.name = "BffError";
    this.status = status;
    this.problem = problem;
  }

  /**
   * 機械判定用のエラーコード。
   */
  get code(): string | null {
    return this.problem?.code ?? null;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

/**
 * BFFを呼び出し、成功応答の`data`を返す。
 */
export async function requestBff<TSchema extends v.GenericSchema>(
  path: string,
  schema: TSchema,
  options: RequestOptions = {},
): Promise<v.InferOutput<TSchema>> {
  const response = await sendBffRequest(path, options);
  const body: unknown = await response.json();
  return v.parse(dataResponseSchema(schema), body).data;
}

/**
 * BFFを呼び出し、成功した応答をそのまま返す（ファイルの取得など`{ data }`以外の応答用）。
 */
export async function sendBffRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const hasBody = options.body !== undefined;
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new BffError(response.status, await readProblemDetails(response));
  }
  return response;
}

/**
 * 失敗応答のbodyを問題詳細として読む。
 */
async function readProblemDetails(response: Response): Promise<ProblemDetails | null> {
  try {
    const result = v.safeParse(problemDetailsSchema, await response.json());
    return result.success ? result.output : null;
  } catch {
    // bodyがJSONでない場合（Workersの障害ページなど）はHTTPステータスだけで扱う。
    return null;
  }
}
