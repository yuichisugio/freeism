import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import type { Database } from "../db/database";
import { D1ClientProvisionRepository } from "../db/repositories/d1-client-provision-repository";
import { auditLog } from "../logging/audit-log";

/**
 * 同意画面の「同意して戻る」（標準`oauth2.consent`の`accept: true`）の受付条件。
 * 今回のクライアントへ証明済みの外部アカウントを1件以上公開選択している場合だけ、標準の同意の保存と認可コードの発行へ進める。
 * 提供していない同意を受け付けると、`oauthConsent`だけが残って次回の同意画面が省かれ、連携直後の一覧も404になるため拒否する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../routes/consent-flow.worker.test.ts
 */

/**
 * 受付条件を満たさない`accept: true`の拒否に使うエラーコード。
 */
const consentRequiresVerifiedAccountCode = "CONSENT_REQUIRES_VERIFIED_ACCOUNT";

/**
 * `hooks.before`に渡す受付条件の確認を作る。
 * user の`hooks.before`は OAuth Provider プラグインの署名検証より先に動くため、`oauth_query`の`client_id`は署名検証前の値になる。
 * 改ざんされた値で通過しても、続く署名検証で400になる。
 * セッションが無い要求は確認せず、標準の`sessionMiddleware`の401に任せる。
 */
export function createConsentGuardBeforeHook({ db }: { db: Database }) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/oauth2/consent" || ctx.body?.accept !== true) {
      return;
    }

    const clientId = new URLSearchParams(String(ctx.body.oauth_query ?? "")).get("client_id");
    const session = await getSessionFromCtx(ctx);
    if (clientId === null || session === null) {
      return;
    }

    if (!(await new D1ClientProvisionRepository(db).isProvided(session.user.id, clientId))) {
      // 標準エンドポイントの前で拒否するため`hooks.after`の監査は動かず、ここで記録する。
      auditLog({
        event: "oauth_consent_accepted",
        outcome: "failure",
        errorCategory: consentRequiresVerifiedAccountCode,
      });
      throw new APIError("BAD_REQUEST", {
        code: consentRequiresVerifiedAccountCode,
        message: "Select at least one verified external account for this client before consenting.",
      });
    }
  });
}
