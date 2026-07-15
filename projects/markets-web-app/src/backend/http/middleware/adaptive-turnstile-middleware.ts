import { createMiddleware } from "hono/factory";

import type { BackendContext } from "../context";
import { problemDetails } from "../problem-details";

export function createAdaptiveTurnstileMiddleware(input: {
  action: string;
  shouldChallenge: (request: Request) => boolean | Promise<boolean>;
}) {
  return createMiddleware<BackendContext>(async (context, next) => {
    if (!(await input.shouldChallenge(context.req.raw))) return next();
    return problemDetails(
      context,
      428,
      "TURNSTILE_REQUIRED",
      `Turnstile challenge required for ${input.action}`,
    );
  });
}
