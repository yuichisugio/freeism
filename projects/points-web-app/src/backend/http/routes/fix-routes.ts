import type { Context, Hono } from "hono";

import { GitHubApiBudgetError } from "../../identity/github-api-budget";
import { GitHubIdentityLookupError } from "../../identity/github-profile-recipient-resolver";
import { commitFixCsv } from "../../usecases/commit-fix-csv";
import { validateFixCsv } from "../../usecases/validate-fix-csv";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

function csvProblem(context: Context<BackendContext>, errors: unknown[]) {
  return context.json(
    {
      code: "CSV_VALIDATION_FAILED",
      errors,
      requestId: `req_${crypto.randomUUID()}`,
      status: 422,
      title: "CSV validation failed",
      type: "https://points.freeism.app/problems/csv-validation-failed",
    },
    422,
    { "Content-Type": "application/problem+json" },
  );
}

function mapFixError(context: Context<BackendContext>, error: unknown): Response {
  if (error instanceof GitHubApiBudgetError) {
    return context.json(
      {
        code: error.message,
        status: 429,
        title: "GitHub identity lookup rate limited",
        type: "https://points.freeism.app/problems/github-identity-lookup-rate-limited",
      },
      429,
      {
        "Content-Type": "application/problem+json",
        "Retry-After": String(error.retryAfterSeconds),
      },
    );
  }
  if (error instanceof GitHubIdentityLookupError) {
    const status = error.code === "GITHUB_IDENTITY_LOOKUP_RATE_LIMITED" ? 429 : 422;
    return context.json(
      {
        code: error.code,
        status,
        title: error.code,
        type: `https://points.freeism.app/problems/${error.code.toLowerCase()}`,
      },
      status,
      {
        "Content-Type": "application/problem+json",
        ...(error.retryAfter ? { "Retry-After": error.retryAfter } : {}),
      },
    );
  }
  if (error instanceof Error && "errors" in error)
    return csvProblem(context, (error as Error & { errors: unknown[] }).errors);
  if (error instanceof Error && error.message === "VALIDATION_CHANGED")
    return problem(context, 409, error.message, "Validation changed");
  if (error instanceof Error && error.message.includes("REVISION_CONFLICT"))
    return problem(context, 409, "REVISION_CONFLICT", "FIX revision conflict");
  if (error instanceof Error && error.message.includes("SAFE_INTEGER_OVERFLOW"))
    return problem(context, 409, "SAFE_INTEGER_OVERFLOW", "Safe integer overflow");
  if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED")
    return problem(context, 409, error.message, "Idempotency key reused");
  throw error;
}

function requireCsv(context: Context<BackendContext>): Response | null {
  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "text/csv"
    ? null
    : problem(context, 415, "CSV_CONTENT_TYPE_REQUIRED", "Content-Type text/csv required");
}

export function registerFixRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  dependencies: { githubFetch?: typeof fetch } = {},
) {
  const session = createSessionMiddleware(getSession);
  app.post(
    "/api/admin/fixes/csv/validate",
    session,
    adminMiddleware,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalidType = requireCsv(context);
      if (invalidType) return invalidType;
      const bytes = new Uint8Array(await context.req.arrayBuffer());
      try {
        const result = await validateFixCsv(requireBindings(context.env).DB, bytes, {
          githubClientId: context.env.GITHUB_CLIENT_ID,
          githubClientSecret: context.env.GITHUB_CLIENT_SECRET,
          githubFetch: dependencies.githubFetch,
        });
        if (result.errors.length > 0) return csvProblem(context, result.errors);
        return context.json({
          data: {
            fileHash: result.fileHash,
            rowCount: result.rows.length,
            validationHash: result.validationHash,
          },
          meta: { requestId: `req_${crypto.randomUUID()}` },
        });
      } catch (error) {
        return mapFixError(context, error);
      }
    },
  );
  app.post(
    "/api/admin/fixes/csv/commit",
    session,
    adminMiddleware,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalidType = requireCsv(context);
      if (invalidType) return invalidType;
      const expectedValidationHash = context.req.header("X-Validation-Hash")?.trim();
      const reason = context.req.header("X-Reason")?.trim();
      if (!expectedValidationHash)
        return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
      if (!reason) return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
      try {
        const committed = await commitFixCsv(
          requireBindings(context.env).DB,
          new Uint8Array(await context.req.arrayBuffer()),
          {
            actorPointsUserId: context.get("pointsUser").id,
            expectedValidationHash,
            githubClientId: context.env.GITHUB_CLIENT_ID,
            githubClientSecret: context.env.GITHUB_CLIENT_SECRET,
            githubFetch: dependencies.githubFetch,
            idempotencyKey: context.req.header("Idempotency-Key")!,
            reason,
          },
        );
        return context.json(committed.responseBody as object, committed.status as 200 | 201);
      } catch (error) {
        return mapFixError(context, error);
      }
    },
  );
}
