import type { ProblemIssue } from "../../shared/schemas/problem-details-schema";

/**
 * BFFの成功応答`{ data }`を作る。
 */
export function dataResponse(data: unknown): Response {
  return Response.json({ data });
}

/**
 * BFFのRFC 9457の失敗応答を作る。
 */
export function problemResponse(status: number, code: string, errors?: ProblemIssue[]): Response {
  return Response.json({ type: "about:blank", title: code, status, code, errors }, { status });
}
