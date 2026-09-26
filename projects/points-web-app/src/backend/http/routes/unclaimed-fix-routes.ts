import type { Context, Hono } from "hono";
import { z } from "zod";

import type { CreateAccountsRecipientResolver } from "../../identity/accounts-recipient-resolver";
import { claimUnclaimedFixes, UnclaimedFixClaimError } from "../../usecases/claim-unclaimed-fixes";
import { previewUnclaimedFixes } from "../../usecases/preview-unclaimed-fixes";
import { toAccountsResolutionProblem } from "../accounts-resolution-problem";
import type { BackendContext } from "../context";
import { requireBindings, type Bindings } from "../context";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware, profileBodyLimit } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

/**
 * 未受領 FIX の受領（preview と一括受領）の経路。
 * 受領資格は、本人の Accounts 連携1件について Accounts の現在の照合結果で決める。
 * @see ../../../../docs/v0.2/details-ja/unclaimed-fix-and-ownership.md
 * @see ../../../../test/worker/unclaimed-claim.worker.test.ts
 */

// --------------------------------------------------
// 要求と応答
// --------------------------------------------------

const claimBodySchema = z
  .object({
    accountsLinkId: z.string().min(1),
    claimSetHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

/**
 * 受領の失敗を problem 応答にする。
 * 集合が変わった場合は、新しい preview を `data` に付ける。
 */
function toClaimProblem(context: Context<BackendContext>, error: unknown): Response {
  const accountsProblem = toAccountsResolutionProblem(context, error);
  if (accountsProblem) return accountsProblem;
  if (error instanceof Error && error.message === "SAFE_INTEGER_OVERFLOW")
    return problem(context, 409, "SAFE_INTEGER_OVERFLOW", "Safe integer overflow");
  if (!(error instanceof UnclaimedFixClaimError)) throw error;
  if (error.code === "ACCOUNTS_LINK_NOT_FOUND")
    return problem(context, 404, error.code, "Accounts link not found");
  if (error.code === "IDEMPOTENCY_KEY_REUSED")
    return problem(context, 409, error.code, "Idempotency key reused");
  if (error.code === "NO_UNCLAIMED_FIXES")
    return problem(context, 409, error.code, "No unclaimed FIX entries");
  return context.json(
    {
      code: error.code,
      data: error.latestPreview,
      requestId: `req_${crypto.randomUUID()}`,
      status: 409,
      title: "Claim set changed",
      type: "https://points.freeism.app/problems/claim-set-changed",
    },
    409,
    { "Content-Type": "application/problem+json" },
  );
}

// --------------------------------------------------
// 経路
// --------------------------------------------------

export function registerUnclaimedFixRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  dependencies: {
    accountsRecipientResolverFor: (bindings: Bindings) => CreateAccountsRecipientResolver;
  },
) {
  const session = createSessionMiddleware(getSession);

  app.get("/api/unclaimed-fixes/claim-preview", session, async (context) => {
    const accountsLinkId = context.req.query("accountsLinkId");
    if (!accountsLinkId)
      return problem(context, 422, "ACCOUNTS_LINK_ID_REQUIRED", "accountsLinkId is required");
    try {
      const bindings = requireBindings(context.env);
      const data = await previewUnclaimedFixes(bindings.DB, {
        accountsLinkId,
        createResolver: dependencies.accountsRecipientResolverFor(bindings),
        pointsUserId: context.get("pointsUser").id,
      });
      return context.json({ data, meta: { requestId: `req_${crypto.randomUUID()}` } });
    } catch (error) {
      return toClaimProblem(context, error);
    }
  });

  app.post(
    "/api/unclaimed-fixes/claims",
    profileBodyLimit,
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      const body = claimBodySchema.safeParse(await context.req.json().catch(() => null));
      if (!body.success)
        return problem(
          context,
          422,
          "CLAIM_BODY_INVALID",
          "Only accountsLinkId and claimSetHash are accepted",
        );
      try {
        const bindings = requireBindings(context.env);
        const result = await claimUnclaimedFixes(bindings.DB, {
          ...body.data,
          createResolver: dependencies.accountsRecipientResolverFor(bindings),
          idempotencyKey: context.req.header("Idempotency-Key")!,
          now: new Date(),
          pointsUserId: context.get("pointsUser").id,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.responseBody as object, result.status as 201);
      } catch (error) {
        return toClaimProblem(context, error);
      }
    },
  );
}
