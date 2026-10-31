import type { Context, Hono } from "hono";
import { APIError } from "better-auth/api";

import { createAccountsFailureReporter } from "../../accounts/accounts-failure-reporter";
import { importAccountsKeyEncryptionKey } from "../../accounts/accounts-key-vault";
import { encodeBase64Url } from "../../accounts/base64url";
import { toAccountsProviderId } from "../../accounts/accounts-provider-id";
import { createPointsAuth } from "../../auth/create-auth";
import { findActiveAccountsConnection } from "../../infrastructure/db/d1-accounts-connection-repository";
import { deleteAccountsLink } from "../../infrastructure/db/d1-accounts-link-repository";
import { AccountsProblemError } from "../../usecases/accounts-problem-error";
import { finishAccountsLink } from "../../usecases/finish-accounts-link";
import { listAccountsLinks } from "../../usecases/list-accounts-links";
import type { AccountsSnapshotDependencies } from "../../usecases/refresh-accounts-link-snapshots";
import type { BackendContext } from "../context";
import { requireBindings } from "../context";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

/**
 * 利用者のAccounts連携の経路（開始・戻り先・一覧・解除）。
 * 連携・解除はPointsのログイン手段とsessionに影響しない。
 * @see ../../auth/create-auth.ts
 * @see ../../usecases/finish-accounts-link.ts
 * @see ../../usecases/complete-accounts-link.ts
 * @see ../../../../test/worker/accounts-link.worker.test.ts
 */

// --------------------------------------------------
// 共通
// --------------------------------------------------

/**
 * 戻り先の処理の後に戻す設定画面。
 */
const settingsPath = "/settings/connections";

/**
 * Accountsへ要求するusecaseの依存を、要求の環境から作る。
 */
async function toSnapshotDependencies(
  context: Context<BackendContext>,
  accountsFetch: typeof fetch,
): Promise<AccountsSnapshotDependencies> {
  const env = requireBindings(context.env);
  return {
    db: env.DB,
    environment: env.APP_ENV,
    kek: await importAccountsKeyEncryptionKey(env.ACCOUNTS_KEY_ENCRYPTION_KEY),
    fetch: accountsFetch,
    reportFailure: createAccountsFailureReporter(env),
  };
}

/**
 * 連携の試行を本人のsessionへ結び付けるためのsession ID。
 */
function requireAuthSessionId(context: Context<BackendContext>): string {
  const sessionId = context.get("authSession").session.id;
  if (sessionId === undefined) throw new Error("Session ID is required");
  return sessionId;
}

/**
 * 戻り先の結果を設定画面へのredirectにする。
 * 成功・失敗とも応答をキャッシュさせない。
 */
function redirectToSettings(query: Record<string, string>): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${settingsPath}?${new URLSearchParams(query).toString()}`,
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

function toProblem(context: Context<BackendContext>, error: unknown): Response {
  if (!(error instanceof AccountsProblemError)) throw error;
  const response = problem(context, error.status, error.code, error.code);
  if (error.retryAfterSeconds !== null) {
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
  }
  return response;
}

// --------------------------------------------------
// 経路
// --------------------------------------------------

export function registerAccountsLinkRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  { accountsFetch }: { accountsFetch: typeof fetch },
) {
  const session = createSessionMiddleware(getSession);

  app.get("/api/accounts-links", session, async (context) => {
    const data = await listAccountsLinks(
      await toSnapshotDependencies(context, accountsFetch),
      context.get("pointsUser").id,
    );
    return context.json({ data, meta: { requestId: `req_${crypto.randomUUID()}` } });
  });

  app.post("/api/accounts-links/attempts", session, async (context) => {
    const contentType = context.req.header("Content-Type")?.split(";", 1)[0]?.trim();
    if (contentType !== "application/json") {
      return problem(context, 415, "JSON_CONTENT_TYPE_REQUIRED", "Content-Type JSON required");
    }
    const body: unknown = await context.req.json().catch(() => null);
    const accountsConnectionId =
      typeof body === "object" && body !== null && "accountsConnectionId" in body
        ? body.accountsConnectionId
        : null;
    if (typeof accountsConnectionId !== "string" || accountsConnectionId.length === 0) {
      return problem(context, 400, "INVALID_REQUEST_BODY", "Invalid request body");
    }
    const env = requireBindings(context.env);
    try {
      const connection = await findActiveAccountsConnection(env.DB, accountsConnectionId);
      if (connection === null)
        throw new AccountsProblemError(409, "ACCOUNTS_CONNECTION_NOT_ACTIVE");
      const ticket = encodeBase64Url(crypto.getRandomValues(new Uint8Array(24)));
      const callbackURL = new URL("/api/accounts-links/finish", env.APP_ORIGIN);
      callbackURL.searchParams.set("ticket", ticket);
      const errorCallbackURL = new URL("/settings/connections", env.APP_ORIGIN);
      errorCallbackURL.searchParams.set("accountsLinkError", "ACCOUNTS_UNAVAILABLE");
      const authResponse = await createPointsAuth(env, {
        accountsConnectionId,
      }).api.linkSocialAccount({
        headers: context.req.raw.headers,
        asResponse: true,
        body: {
          provider: toAccountsProviderId(accountsConnectionId),
          callbackURL: callbackURL.toString(),
          errorCallbackURL: errorCallbackURL.toString(),
          disableRedirect: true,
        },
      });
      if (!authResponse.ok) {
        const status = authResponse.status === 429 ? 429 : 503;
        const code = status === 429 ? "ACCOUNTS_LINK_RATE_LIMITED" : "ACCOUNTS_UNAVAILABLE";
        return problem(context, status, code, code);
      }
      const result = (await authResponse.json()) as { url?: string };
      if (!result.url) throw new AccountsProblemError(503, "ACCOUNTS_UNAVAILABLE");
      const response = context.json(
        {
          data: { authorizationUrl: result.url },
          meta: { requestId: `req_${crypto.randomUUID()}` },
        },
        201,
      );
      for (const cookie of authResponse.headers.getSetCookie()) {
        response.headers.append("Set-Cookie", cookie);
      }
      return response;
    } catch (error) {
      if (error instanceof APIError) {
        const status = error.statusCode === 429 ? 429 : 503;
        const code = status === 429 ? "ACCOUNTS_LINK_RATE_LIMITED" : "ACCOUNTS_UNAVAILABLE";
        return problem(context, status, code, code);
      }
      return toProblem(context, error);
    }
  });

  app.get("/api/accounts-links/finish", session, async (context) => {
    const ticket = context.req.query("ticket");
    if (!ticket) return redirectToSettings({ accountsLinkError: "ACCOUNTS_LINK_ATTEMPT_INVALID" });
    try {
      await finishAccountsLink(await toSnapshotDependencies(context, accountsFetch), {
        ticket,
        pointsUserId: context.get("pointsUser").id,
        authSessionId: requireAuthSessionId(context),
        requestId: `req_${crypto.randomUUID()}`,
      });
      return redirectToSettings({ accountsLinkResult: "LINKED" });
    } catch (error) {
      if (!(error instanceof AccountsProblemError)) throw error;
      return redirectToSettings({ accountsLinkError: error.code });
    }
  });

  app.delete("/api/accounts-links/:accountsLinkId", session, async (context) => {
    const isDeleted = await deleteAccountsLink(requireBindings(context.env).DB, {
      environment: requireBindings(context.env).APP_ENV,
      accountsLinkId: context.req.param("accountsLinkId"),
      pointsUserId: context.get("pointsUser").id,
      requestId: `req_${crypto.randomUUID()}`,
    });
    if (!isDeleted)
      return problem(context, 404, "ACCOUNTS_LINK_NOT_FOUND", "Accounts link not found");
    return context.body(null, 204);
  });
}
