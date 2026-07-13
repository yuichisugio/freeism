import type { Context } from "hono";

import type { BackendContext } from "./context";

export type ProblemStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 428 | 429 | 500 | 502;

export function problemDetails(
  context: Context<BackendContext>,
  status: ProblemStatus,
  code: string,
  title: string,
) {
  return context.json(
    {
      code,
      requestId: `req_${crypto.randomUUID()}`,
      status,
      title,
      type: `https://markets.freeism.app/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    },
    status,
    { "Cache-Control": "private, no-store", "Content-Type": "application/problem+json" },
  );
}
