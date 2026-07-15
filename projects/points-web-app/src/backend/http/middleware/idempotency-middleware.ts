import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";

import type { BackendContext } from "../context";
import { problem } from "../problem";

export const profileBodyLimit = bodyLimit({
  maxSize: 64 * 1024,
  onError: (context) =>
    problem(
      context as Parameters<typeof problem>[0],
      413,
      "REQUEST_BODY_TOO_LARGE",
      "Request body too large",
    ),
});

export const idempotencyKeyMiddleware = createMiddleware<BackendContext>(async (context, next) => {
  const idempotencyKey = context.req.header("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return problem(context, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
  }
  await next();
});
