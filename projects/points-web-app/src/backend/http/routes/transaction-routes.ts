import type { Context, Hono } from "hono";

import { commitExchanges, validateExchangeCsv } from "../../usecases/commit-exchanges";
import { commitTransfers, validateTransferCsv } from "../../usecases/commit-transfers";
import {
  commitExchangeRateCsv,
  validateExchangeRateCsv,
} from "../../usecases/import-exchange-rates";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

function requireCsv(context: Context<BackendContext>): Response | null {
  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "text/csv"
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

function mapTransactionError(context: Context<BackendContext>, error: unknown): Response {
  if (error instanceof Error && "errors" in error) {
    return csvProblem(context, (error as Error & { errors: unknown[] }).errors);
  }
  if (error instanceof Error && error.message === "VALIDATION_CHANGED") {
    return problem(context, 409, error.message, "Validation changed");
  }
  if (error instanceof Error && error.message.includes("POINT_TRANSACTION_REFERENCE_INVALID")) {
    return problem(context, 409, "VALIDATION_CHANGED", "Validation changed");
  }
  if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_REUSED") {
    return problem(context, 409, error.message, "Idempotency key reused");
  }
  if (error instanceof Error && error.message.includes("REVISION_CONFLICT")) {
    return problem(context, 409, "REVISION_CONFLICT", "Revision conflict");
  }
  if (error instanceof Error && error.message.includes("INSUFFICIENT_BALANCE")) {
    return problem(context, 409, "INSUFFICIENT_BALANCE", "Insufficient balance");
  }
  if (error instanceof Error && error.message.includes("SAFE_INTEGER_OVERFLOW")) {
    return problem(context, 409, "SAFE_INTEGER_OVERFLOW", "Safe integer overflow");
  }
  throw error;
}

function validationResponse(
  context: Context<BackendContext>,
  result: { errors: unknown[]; rows: unknown[]; validationHash: string; fileHash: string },
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

export function registerTransactionRoutes(app: Hono<BackendContext>, getSession: GetSession) {
  const session = createSessionMiddleware(getSession);
  app.post(
    "/api/admin/exchange-rates/csv/validate",
    session,
    adminMiddleware,
    csvBodyLimitMiddleware,
    async (context) => {
      const invalidType = requireCsv(context);
      if (invalidType) return invalidType;
      return validationResponse(
        context,
        await validateExchangeRateCsv(
          requireBindings(context.env).DB,
          new Uint8Array(await context.req.arrayBuffer()),
        ),
      );
    },
  );
  app.post(
    "/api/admin/exchange-rates/csv/commit",
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
      if (!expectedValidationHash) {
        return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
      }
      if (!reason) return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
      try {
        const result = await commitExchangeRateCsv(
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
        return mapTransactionError(context, error);
      }
    },
  );

  for (const transaction of ["transfers", "exchanges"] as const) {
    app.post(
      `/api/${transaction}/csv/validate`,
      session,
      csvBodyLimitMiddleware,
      async (context) => {
        const invalidType = requireCsv(context);
        if (invalidType) return invalidType;
        const bytes = new Uint8Array(await context.req.arrayBuffer());
        const db = requireBindings(context.env).DB;
        const pointsUserId = context.get("pointsUser").id;
        return validationResponse(
          context,
          transaction === "transfers"
            ? await validateTransferCsv(db, bytes, pointsUserId)
            : await validateExchangeCsv(db, bytes, pointsUserId),
        );
      },
    );
    app.post(
      `/api/${transaction}/csv/commit`,
      session,
      googleFreshMiddleware,
      idempotencyKeyMiddleware,
      csvBodyLimitMiddleware,
      async (context) => {
        const invalidType = requireCsv(context);
        if (invalidType) return invalidType;
        const expectedValidationHash = context.req.header("X-Validation-Hash")?.trim();
        if (!expectedValidationHash) {
          return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
        }
        try {
          const db = requireBindings(context.env).DB;
          const bytes = new Uint8Array(await context.req.arrayBuffer());
          const input = {
            actorPointsUserId: context.get("pointsUser").id,
            expectedValidationHash,
            idempotencyKey: context.req.header("Idempotency-Key")!,
          };
          const result =
            transaction === "transfers"
              ? await commitTransfers(db, bytes, input)
              : await commitExchanges(db, bytes, input);
          return context.json(result.responseBody as object, result.status as 201);
        } catch (error) {
          return mapTransactionError(context, error);
        }
      },
    );
  }
}
