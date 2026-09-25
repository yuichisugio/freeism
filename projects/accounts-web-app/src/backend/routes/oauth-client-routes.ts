import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";

import { oauthClientSchema } from "../../shared/schemas/oauth-client-schema";
import type { ProblemDetails, ProblemIssue } from "../../shared/schemas/problem-details-schema";
import { getAuth } from "../auth/auth";
import { createDatabase } from "../db/database";
import type { AppEnv } from "../hono-env";
import { deleteOAuthClient } from "../usecases/oauth-client/delete-oauth-client";
import { listOAuthClients } from "../usecases/oauth-client/list-oauth-clients";
import { OAuthClientError } from "../usecases/oauth-client/oauth-client-error";
import type { OAuthClientDeps } from "../usecases/oauth-client/oauth-client-fields";
import { readOAuthClient } from "../usecases/oauth-client/read-oauth-client";
import { registerOAuthClient } from "../usecases/oauth-client/register-oauth-client";
import { updateOAuthClient } from "../usecases/oauth-client/update-oauth-client";

/**
 * 「開発者向け」画面のOAuthクライアント管理（`/api/oauth-clients`）。
 * 成功は`{ data }`、失敗はRFC 9457の問題詳細で返す。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./oauth-client-routes.worker.test.ts
 */

// --------------------------------------------------
// 応答
// --------------------------------------------------

/**
 * 失敗の種類ごとのHTTPステータス。
 */
const problemStatuses = {
  UNAUTHORIZED: 401,
  INVALID_JSON: 400,
  INVALID_VALUE: 400,
  INVALID_JWKS: 400,
  INVALID_CLIENT_METADATA: 400,
  CLIENT_NOT_FOUND: 404,
  CLIENT_LIMIT_REACHED: 409,
  CLIENT_KEY_SAVE_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const satisfies Record<string, ContentfulStatusCode>;

type ProblemCode = keyof typeof problemStatuses;

/**
 * RFC 9457の問題詳細を返す。
 * `type`は問題の種類ごとの文書を持たないため`about:blank`とし、`title`には`code`を入れる。
 */
function problemResponse(
  c: Context<AppEnv>,
  code: ProblemCode,
  extra: { detail?: string; errors?: ProblemIssue[] } = {},
) {
  const status = problemStatuses[code];
  const problem: ProblemDetails & { detail?: string } = {
    type: "about:blank",
    title: code,
    status,
    code,
    ...extra,
  };
  return c.json(problem, status, { "Content-Type": "application/problem+json" });
}

/**
 * Valibotの不備を、`MISSING_REQUIRED_FIELD`・`UNKNOWN_FIELD`・`INVALID_TYPE`・`INVALID_VALUE`に分類した問題詳細の`errors`へ変換する。
 */
function toProblemIssues(issues: readonly v.GenericIssue[]): ProblemIssue[] {
  return issues.map((issue) => ({
    code:
      issue.kind === "validation"
        ? "INVALID_VALUE"
        : issue.type === "strict_object" && issue.expected === "never"
          ? "UNKNOWN_FIELD"
          : issue.received === "undefined"
            ? "MISSING_REQUIRED_FIELD"
            : "INVALID_TYPE",
    message: issue.message,
    path: issue.path?.map((item) => item.key as string | number) ?? null,
  }));
}

// --------------------------------------------------
// セッションと入力
// --------------------------------------------------

/**
 * セッション本人を確認し、ユースケースの依存を作る。
 * 変更操作（`fresh`）はcookie cacheを使わずDBのセッションを読む。
 * 共通のセッションミドルウェアができたら、そちらへ置き換える。
 */
async function readOAuthClientDeps(
  c: Context<AppEnv>,
  { fresh }: { fresh: boolean },
): Promise<OAuthClientDeps | null> {
  const auth = getAuth();
  const headers = c.req.raw.headers;
  const session = await auth.api.getSession({ headers, query: { disableCookieCache: fresh } });
  if (!session) {
    return null;
  }
  return { auth, db: createDatabase(c.env.DB), headers, userId: session.user.id };
}

/**
 * 要求bodyを登録・更新の入力として検査する。
 */
async function parseOAuthClientInput(c: Context<AppEnv>) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { problem: problemResponse(c, "INVALID_JSON") } as const;
  }
  const result = v.safeParse(oauthClientSchema, body);
  if (!result.success) {
    return {
      problem: problemResponse(c, "INVALID_VALUE", { errors: toProblemIssues(result.issues) }),
    } as const;
  }
  return { input: result.output } as const;
}

// --------------------------------------------------
// ルート
// --------------------------------------------------

export const oauthClientRoutes = new Hono<AppEnv>()
  .use(async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  })
  .get("/", async (c) => {
    const deps = await readOAuthClientDeps(c, { fresh: false });
    if (!deps) return problemResponse(c, "UNAUTHORIZED");

    const clients = await listOAuthClients(deps);
    return c.json({ data: { clients } }, 200);
  })
  .post("/", async (c) => {
    const deps = await readOAuthClientDeps(c, { fresh: true });
    if (!deps) return problemResponse(c, "UNAUTHORIZED");
    const parsed = await parseOAuthClientInput(c);
    if (parsed.problem) return parsed.problem;

    const client = await registerOAuthClient(deps, parsed.input);
    return c.json({ data: client }, 201);
  })
  .get("/:clientId", async (c) => {
    const deps = await readOAuthClientDeps(c, { fresh: false });
    if (!deps) return problemResponse(c, "UNAUTHORIZED");

    const client = await readOAuthClient(deps, c.req.param("clientId"));
    return c.json({ data: client }, 200);
  })
  .put("/:clientId", async (c) => {
    const deps = await readOAuthClientDeps(c, { fresh: true });
    if (!deps) return problemResponse(c, "UNAUTHORIZED");
    const parsed = await parseOAuthClientInput(c);
    if (parsed.problem) return parsed.problem;

    const client = await updateOAuthClient(deps, c.req.param("clientId"), parsed.input);
    return c.json({ data: client }, 200);
  })
  .delete("/:clientId", async (c) => {
    const deps = await readOAuthClientDeps(c, { fresh: true });
    if (!deps) return problemResponse(c, "UNAUTHORIZED");

    await deleteOAuthClient(deps, c.req.param("clientId"));
    return c.json({ data: { ok: true as const } }, 200);
  })
  .onError((error, c) => {
    if (error instanceof OAuthClientError) {
      return problemResponse(c, error.code, { detail: error.detail });
    }
    // 例外のメッセージにはSQLのパラメーター（ユーザーIDなど）が含まれうるため、種類だけを記録する。
    console.error(JSON.stringify({ event: "bff_error", errorName: error.name }));
    return problemResponse(c, "INTERNAL_ERROR");
  });
