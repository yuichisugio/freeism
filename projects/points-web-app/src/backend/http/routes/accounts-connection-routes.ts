import type { Context, Hono } from "hono";

import { importAccountsKeyEncryptionKey } from "../../accounts/accounts-key-vault";
import { freshOperationPolicies } from "../../auth/fresh-operation-policy";
import { listActiveAccountsConnections } from "../../infrastructure/db/d1-accounts-connection-repository";
import { AccountsProblemError } from "../../usecases/accounts-problem-error";
import { listAccountsConnectionViews } from "../../usecases/list-accounts-connections";
import {
  activateAccountsConnection,
  createAccountsConnection,
  withdrawAccountsConnection,
  type AccountsConnectionCommand,
} from "../../usecases/manage-accounts-connections";
import { ProfileMutationIdempotencyConflictError } from "../../usecases/profile-mutation-idempotency";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { adminMiddleware } from "../middleware/admin-middleware";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

/**
 * 接続先Accountsの経路。
 * - 運営者（ADMIN）: 一覧・作成・有効化・取り下げ。変更にはGoogle fresh・理由・Idempotency-Keyを要する。
 * - 利用者（session）: `ACTIVE`の接続先の一覧（連携の開始・FIXの取込で選ぶ）。
 * @see ../../usecases/manage-accounts-connections.ts
 * @see ../../../../test/worker/accounts-connection.worker.test.ts
 */

// --------------------------------------------------
// 共通
// --------------------------------------------------

function requirePolicyRoute(operation: string): string {
  const policy = freshOperationPolicies.find((candidate) => candidate.operation === operation);
  if (policy === undefined) throw new Error(`FRESH_OPERATION_POLICY_MISSING:${operation}`);
  return policy.route;
}

async function readJsonObject(context: Context<BackendContext>) {
  const body: unknown = await context.req.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
}

/**
 * 運営者の操作に共通する入力を要求から作る。
 */
function toCommand(context: Context<BackendContext>, reason: unknown): AccountsConnectionCommand {
  const env = requireBindings(context.env);
  return {
    db: env.DB,
    appOrigin: env.APP_ORIGIN,
    actorPointsUserId: context.get("pointsUser").id,
    reason,
    idempotencyKey: context.req.header("Idempotency-Key")!,
    requestId: `req_${crypto.randomUUID()}`,
  };
}

/**
 * 操作の失敗をProblem Detailsにする。
 */
function toProblem(context: Context<BackendContext>, error: unknown): Response {
  if (error instanceof AccountsProblemError) {
    return problem(context, error.status, error.code, error.code);
  }
  if (error instanceof ProfileMutationIdempotencyConflictError) {
    return problem(context, 409, error.message, "Idempotency key reused");
  }
  throw error;
}

// --------------------------------------------------
// 経路
// --------------------------------------------------

export function registerAccountsConnectionRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  { accountsFetch }: { accountsFetch: typeof fetch },
) {
  const session = createSessionMiddleware(getSession);
  const adminMutation = [
    session,
    adminMiddleware,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
  ] as const;

  app.get("/api/admin/accounts-connections", session, adminMiddleware, async (context) => {
    const env = requireBindings(context.env);
    return context.json({
      data: await listAccountsConnectionViews(env.DB, env.APP_ORIGIN),
      meta: { requestId: `req_${crypto.randomUUID()}` },
    });
  });

  app.post(requirePolicyRoute("accounts-connection-create"), ...adminMutation, async (context) => {
    const body = await readJsonObject(context);
    if (body === null) return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
    const env = requireBindings(context.env);
    try {
      const result = await createAccountsConnection({
        ...toCommand(context, body.reason),
        kek: await importAccountsKeyEncryptionKey(env.ACCOUNTS_KEY_ENCRYPTION_KEY),
        fetch: accountsFetch,
        allowLoopbackHttp: env.APP_ENV === "local",
        accountsOrigin: body.accountsOrigin,
        displayName: body.displayName,
      });
      return context.json(result.body, result.status);
    } catch (error) {
      return toProblem(context, error);
    }
  });

  app.post(
    requirePolicyRoute("accounts-connection-activate"),
    ...adminMutation,
    async (context) => {
      const body = await readJsonObject(context);
      if (body === null)
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      const env = requireBindings(context.env);
      try {
        const result = await activateAccountsConnection({
          ...toCommand(context, body.reason),
          kek: await importAccountsKeyEncryptionKey(env.ACCOUNTS_KEY_ENCRYPTION_KEY),
          fetch: accountsFetch,
          connectionId: context.req.param("accountsConnectionId")!,
          clientId: body.clientId,
        });
        return context.json(result.body, result.status);
      } catch (error) {
        return toProblem(context, error);
      }
    },
  );

  app.post(
    requirePolicyRoute("accounts-connection-withdraw"),
    ...adminMutation,
    async (context) => {
      const body = await readJsonObject(context);
      if (body === null)
        return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
      try {
        const result = await withdrawAccountsConnection({
          ...toCommand(context, body.reason),
          connectionId: context.req.param("accountsConnectionId")!,
        });
        return context.json(result.body, result.status);
      } catch (error) {
        return toProblem(context, error);
      }
    },
  );

  app.get("/api/accounts-connections", session, async (context) => {
    return context.json({
      data: await listActiveAccountsConnections(requireBindings(context.env).DB),
      meta: { requestId: `req_${crypto.randomUUID()}` },
    });
  });
}
