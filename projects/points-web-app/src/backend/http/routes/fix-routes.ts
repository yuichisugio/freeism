import type { Context, Hono } from "hono";

import {
  AccountsRecipientResolutionError,
  createUnconfiguredAccountsRecipientResolver,
  type AccountsRecipientResolver,
  type CreateAccountsRecipientResolver,
} from "../../identity/accounts-recipient-resolver";
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
  if (error instanceof AccountsRecipientResolutionError)
    return problem(context, 422, error.code, "Accounts connection required");
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

/**
 * 要求で指定された接続先 Accounts に対する照合関数を返す。
 * 接続先の指定が無い時は `ACCOUNTS_CONNECTION_REQUIRED` にする。
 */
function recipientResolverFor(
  context: Context<BackendContext>,
  createResolver: CreateAccountsRecipientResolver,
): AccountsRecipientResolver {
  const accountsConnectionId = context.req.header("X-Accounts-Connection-Id")?.trim();
  if (!accountsConnectionId)
    throw new AccountsRecipientResolutionError("ACCOUNTS_CONNECTION_REQUIRED");
  return createResolver(accountsConnectionId);
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
  dependencies: { createAccountsRecipientResolver?: CreateAccountsRecipientResolver } = {},
) {
  const createResolver =
    dependencies.createAccountsRecipientResolver ?? createUnconfiguredAccountsRecipientResolver;
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
          resolveRecipients: recipientResolverFor(context, createResolver),
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
            idempotencyKey: context.req.header("Idempotency-Key")!,
            reason,
            resolveRecipients: recipientResolverFor(context, createResolver),
          },
        );
        return context.json(committed.responseBody as object, committed.status as 200 | 201);
      } catch (error) {
        return mapFixError(context, error);
      }
    },
  );
}
