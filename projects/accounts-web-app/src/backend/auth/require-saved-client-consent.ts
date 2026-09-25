import { and, eq } from "drizzle-orm";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import type { Database } from "../db/database";
import { clientConsents } from "../db/schema";

/**
 * 同意画面の「同意して戻る」（標準`/oauth2/consent`の`accept: true`）の前に、今回の連携先への情報提供同意がONで保存済みかを確認する`hooks.before`。
 * 保存されていなければ400 `CONSENT_NOT_SAVED`で拒否し、認可コードを発行しない。
 * 署名付きクエリ（`oauth_query`）の改ざんは、続くOAuth Providerの標準の検証で拒否される。
 * `accept: false`・署名付きクエリやセッションの無い要求は、標準の処理に任せる。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../routes/consent-flow.worker.test.ts
 */
export function requireSavedClientConsent(db: Database) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/oauth2/consent" || ctx.body?.accept !== true) return;
    const oauthQuery: unknown = ctx.body?.oauth_query;
    const clientId =
      typeof oauthQuery === "string" ? new URLSearchParams(oauthQuery).get("client_id") : null;
    const session = await getSessionFromCtx(ctx);
    if (clientId === null || session === null) return;

    const [consent] = await db
      .select({ consented: clientConsents.consented })
      .from(clientConsents)
      .where(and(eq(clientConsents.userId, session.user.id), eq(clientConsents.clientId, clientId)))
      .limit(1);
    if (consent?.consented !== true) {
      throw new APIError("BAD_REQUEST", {
        code: "CONSENT_NOT_SAVED",
        message: "Save the consent for this client before accepting.",
      });
    }
  });
}
