import type { Context, Hono } from "hono";

import {
  commitAutoDistributionSettingCsv,
  validateAutoDistributionSettingCsv,
} from "../../usecases/commit-auto-distribution-settings";
import {
  commitSubstitutionCsv,
  validateSubstitutionCsv,
} from "../../usecases/commit-substitution-fixes";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

function requireCsv(context: Context<BackendContext>): Response | null {
  const type = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  return type === "text/csv"
    ? null
    : problem(context, 415, "CSV_CONTENT_TYPE_REQUIRED", "Content-Type text/csv required");
}

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

function validationResponse(
  context: Context<BackendContext>,
  result: { errors: unknown[]; fileHash: string; rows: unknown[]; validationHash: string },
) {
  if (result.errors.length > 0) return csvProblem(context, result.errors);
  return context.json({
    data: {
      fileHash: result.fileHash,
      rowCount: result.rows.length,
      validationHash: result.validationHash,
    },
    meta: { requestId: `req_${crypto.randomUUID()}` },
  });
}

function mapError(context: Context<BackendContext>, error: unknown): Response {
  if (error instanceof Error && "errors" in error)
    return csvProblem(context, (error as Error & { errors: unknown[] }).errors);
  if (error instanceof Error && error.message === "VALIDATION_CHANGED")
    return problem(context, 409, error.message, "Validation changed");
  if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED")
    return problem(context, 409, error.message, "Idempotency key reused");
  if (error instanceof Error && error.message.includes("REVISION_CONFLICT"))
    return problem(context, 409, "REVISION_CONFLICT", "Revision conflict");
  if (error instanceof Error && error.message.includes("SAFE_INTEGER_OVERFLOW"))
    return problem(context, 409, "SAFE_INTEGER_OVERFLOW", "Safe integer overflow");
  if (error instanceof Error && error.message.includes("AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED"))
    return problem(
      context,
      422,
      "AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED",
      "Auto distribution target limit exceeded",
    );
  throw error;
}

export function registerDistributionRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const session = createSessionMiddleware(getSession);
  app.post(
    "/api/admin/substitutions/csv/validate",
    session,
    adminMiddleware,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalid = requireCsv(context);
      if (invalid) return invalid;
      return validationResponse(
        context,
        await validateSubstitutionCsv(
          requireBindings(context.env).DB,
          new Uint8Array(await context.req.arrayBuffer()),
        ),
      );
    },
  );
  app.post(
    "/api/admin/substitutions/csv/commit",
    session,
    adminMiddleware,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalid = requireCsv(context);
      if (invalid) return invalid;
      const expectedValidationHash = context.req.header("X-Validation-Hash")?.trim();
      const reason = context.req.header("X-Reason")?.trim();
      if (!expectedValidationHash)
        return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
      if (!reason) return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
      try {
        const result = await commitSubstitutionCsv(
          requireBindings(context.env).DB,
          new Uint8Array(await context.req.arrayBuffer()),
          {
            actorPointsUserId: context.get("pointsUser").id,
            expectedValidationHash,
            idempotencyKey: context.req.header("Idempotency-Key")!,
            reason,
          },
        );
        return context.json(result.responseBody as object, result.status as 201);
      } catch (error) {
        return mapError(context, error);
      }
    },
  );

  app.post(
    "/api/settings/auto-distribution/csv/validate",
    session,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalid = requireCsv(context);
      if (invalid) return invalid;
      return validationResponse(
        context,
        await validateAutoDistributionSettingCsv(
          requireBindings(context.env).DB,
          new Uint8Array(await context.req.arrayBuffer()),
          context.get("pointsUser").id,
        ),
      );
    },
  );
  app.post(
    "/api/settings/auto-distribution/csv/commit",
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalid = requireCsv(context);
      if (invalid) return invalid;
      const expectedValidationHash = context.req.header("X-Validation-Hash")?.trim();
      if (!expectedValidationHash)
        return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
      try {
        const result = await commitAutoDistributionSettingCsv(
          requireBindings(context.env).DB,
          new Uint8Array(await context.req.arrayBuffer()),
          {
            expectedValidationHash,
            idempotencyKey: context.req.header("Idempotency-Key")!,
            pointsUserId: context.get("pointsUser").id,
          },
        );
        return context.json(result.responseBody as object, result.status as 201);
      } catch (error) {
        return mapError(context, error);
      }
    },
  );
}
