import type { Context } from "hono";

import type { BackendContext } from "./context";

type ProblemStatus = 400 | 401 | 403 | 409 | 413 | 422;

export function problem(
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
      type: `https://points.freeism.app/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    },
    status,
    { "Content-Type": "application/problem+json" },
  );
}
