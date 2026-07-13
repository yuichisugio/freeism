import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";

import type { BackendContext } from "../context";
import { problemDetails } from "../problem-details";

const jsonMutationMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export const jsonMutationBodyLimit = bodyLimit({
  maxSize: 64 * 1024,
  onError: (context) =>
    problemDetails(
      context as Parameters<typeof problemDetails>[0],
      413,
      "REQUEST_BODY_TOO_LARGE",
      "Request body too large",
    ),
});

export const requestSecurityMiddleware = createMiddleware<BackendContext>(async (context, next) => {
  if (!jsonMutationMethods.has(context.req.method)) return next();

  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (context.req.raw.body !== null && contentType !== "application/json") {
    return problemDetails(
      context,
      415,
      "CONTENT_TYPE_UNSUPPORTED",
      "Content-Type must be application/json",
    );
  }

  const origin = context.req.header("Origin");
  if (origin && origin !== context.env.APP_ORIGIN) {
    return problemDetails(context, 403, "REQUEST_ORIGIN_REJECTED", "Request origin rejected");
  }
  if (context.req.header("Sec-Fetch-Site")?.toLowerCase() === "cross-site") {
    return problemDetails(
      context,
      403,
      "CROSS_SITE_REQUEST_REJECTED",
      "Cross-site request rejected",
    );
  }

  await next();
});
