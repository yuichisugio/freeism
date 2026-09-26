import type { Context, Hono } from "hono";

import {
  AccountsRecipientResolutionError,
  type CreateAccountsRecipientResolver,
} from "../../identity/accounts-recipient-resolver";
import { commitFixCsv } from "../../usecases/commit-fix-csv";
import { validateFixCsv, type ValidatedFixCsv } from "../../usecases/validate-fix-csv";
import type { BackendContext } from "../context";
import { requireBindings, type Bindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { csvBodyLimitMiddleware } from "../middleware/csv-body-limit-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

/**
 * FIX CSV の validate・commit。
 * 受領者の照合に使う接続先 Accounts を `X-Accounts-Connection-Id` で受け取る。
 * @see ../../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 * @see ../../../../test/worker/fix-ledger.worker.test.ts
 */

// --------------------------------------------------
// 応答
// --------------------------------------------------

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

function accountsConnectionRequired(context: Context<BackendContext>): Response {
  return problem(context, 422, "ACCOUNTS_CONNECTION_REQUIRED", "Accounts connection required");
}

/**
 * FIX 取込で投げられたエラーを problem 応答へ変換する。
 */
function mapFixError(context: Context<BackendContext>, error: unknown): Response {
  if (
    error instanceof AccountsRecipientResolutionError &&
    error.code === "ACCOUNTS_CONNECTION_NOT_ACTIVE"
  )
    return problem(context, 409, error.code, "Accounts connection is not active");
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
 * validate の応答本文。
 * 受領者の照合結果を行ごとに返す。
 * 照合できなかった場合は全行を `UNRESOLVED` とし、確定に使う `validationHash` を返さない。
 */
function toValidationBody(result: Exclude<ValidatedFixCsv, { status: "INVALID" }>) {
  if (result.status === "UNRESOLVED") {
    const { code, retryAfter } = result.failure;
    return {
      accountsOrigin: null,
      accountsResolution: {
        code: code === "ACCOUNTS_UNAVAILABLE" ? "ACCOUNTS_RESOLVE_UNAVAILABLE" : code,
        retryAfter,
        status: "UNAVAILABLE",
      },
      fileHash: result.fileHash,
      rowCount: result.rowCount,
      rows: Array.from({ length: result.rowCount }, (_, index) => ({
        recipientLinked: false,
        resolution: "UNRESOLVED",
        row: index + 2,
      })),
      validationHash: null,
    };
  }
  return {
    accountsOrigin: result.accountsOrigin,
    accountsResolution: { status: "COMPLETE" },
    fileHash: result.fileHash,
    rowCount: result.rows.length,
    rows: result.rows.map((row, index) => ({
      recipientLinked: row.recipientPointsUserId !== null,
      resolution: row.resolvedAccountsUserId === null ? "NO_MATCH" : "MATCHED",
      row: index + 2,
    })),
    validationHash: result.validationHash,
  };
}

function requireCsv(context: Context<BackendContext>): Response | null {
  const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "text/csv"
    ? null
    : problem(context, 415, "CSV_CONTENT_TYPE_REQUIRED", "Content-Type text/csv required");
}

// --------------------------------------------------
// 経路
// --------------------------------------------------

export function registerFixRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  dependencies: {
    accountsRecipientResolverFor: (bindings: Bindings) => CreateAccountsRecipientResolver;
  },
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
      const accountsConnectionId = context.req.header("X-Accounts-Connection-Id")?.trim();
      if (!accountsConnectionId) return accountsConnectionRequired(context);
      const bytes = new Uint8Array(await context.req.arrayBuffer());
      try {
        const bindings = requireBindings(context.env);
        const result = await validateFixCsv(bindings.DB, bytes, {
          accountsConnectionId,
          createResolver: dependencies.accountsRecipientResolverFor(bindings),
        });
        if (result.status === "INVALID") return csvProblem(context, result.errors);
        return context.json({
          data: { accountsConnectionId, ...toValidationBody(result) },
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
      const accountsConnectionId = context.req.header("X-Accounts-Connection-Id")?.trim();
      if (!accountsConnectionId) return accountsConnectionRequired(context);
      const expectedValidationHash = context.req.header("X-Validation-Hash")?.trim();
      const reason = context.req.header("X-Reason")?.trim();
      if (!expectedValidationHash)
        return problem(context, 422, "VALIDATION_HASH_REQUIRED", "Validation hash required");
      if (!reason) return problem(context, 422, "ADMIN_REASON_REQUIRED", "Admin reason required");
      try {
        const bindings = requireBindings(context.env);
        const committed = await commitFixCsv(
          bindings.DB,
          new Uint8Array(await context.req.arrayBuffer()),
          {
            accountsConnectionId,
            actorPointsUserId: context.get("pointsUser").id,
            createResolver: dependencies.accountsRecipientResolverFor(bindings),
            expectedValidationHash,
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
