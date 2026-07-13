import type { Context, Hono } from "hono";

import type { GetGitHubAccessToken } from "../../auth/github-identity-grant";
import { normalizeIdentityUrl } from "../../domain/ownership/normalize-identity-url";
import { claimUnclaimedFixes, OwnershipClaimError } from "../../usecases/claim-unclaimed-fixes";
import {
  deactivateGitHubOwnership,
  GitHubOwnershipError,
} from "../../usecases/deactivate-github-ownership";
import { previewUnclaimedFixes } from "../../usecases/preview-unclaimed-fixes";
import { reactivateGitHubOwnership } from "../../usecases/reactivate-github-ownership";
import { verifyWebOwnership, WebOwnershipError } from "../../usecases/verify-web-ownership";
import type { BackendContext } from "../context";
import { hashCanonicalPayload } from "../../domain/idempotency/idempotency-result";
import { requireBindings } from "../context";
import { googleFreshMiddleware } from "../middleware/google-fresh-middleware";
import { idempotencyKeyMiddleware } from "../middleware/idempotency-middleware";
import { createSessionMiddleware, type GetSession } from "../middleware/session-middleware";
import { problem } from "../problem";

function mapOwnershipError(context: Context<BackendContext>, error: unknown): Response {
  if (error instanceof Error && error.message.includes("SAFE_INTEGER_OVERFLOW"))
    return problem(context, 409, "SAFE_INTEGER_OVERFLOW", "Safe integer overflow");
  if (!(error instanceof OwnershipClaimError)) throw error;
  if (error.code === "OWNERSHIP_NOT_FOUND")
    return problem(context, 404, error.code, "Ownership not found");
  if (error.code === "OWNERSHIP_NOT_ACTIVE")
    return problem(context, 409, error.code, "Ownership is not active");
  if (error.code === "IDEMPOTENCY_KEY_REUSED")
    return problem(context, 409, error.code, "Idempotency key reused");
  if (error.code === "NO_UNCLAIMED_FIXES")
    return problem(context, 409, error.code, "No unclaimed FIX entries");
  return problem(context, 409, error.code, "Claim set changed");
}

function mapGitHubOwnershipError(context: Context<BackendContext>, error: unknown): Response {
  if (!(error instanceof GitHubOwnershipError)) throw error;
  if (error.code === "GITHUB_ACCOUNT_NOT_LINKED" || error.code === "GITHUB_OWNERSHIP_NOT_FOUND") {
    return problem(context, 404, error.code, "GitHub ownership not found");
  }
  if (error.code === "GITHUB_TOKEN_ACCESS_FAILED" || error.code === "GITHUB_TOKEN_REVOKE_FAILED") {
    return problem(context, 502, error.code, "GitHub token operation failed");
  }
  return problem(context, 409, error.code, "GitHub ownership cannot be changed");
}

async function readGitHubAccountId(context: Context<BackendContext>): Promise<string | null> {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return null;
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof (body as { accountId?: unknown }).accountId !== "string" ||
    (body as { accountId: string }).accountId.length === 0
  ) {
    return null;
  }
  return (body as { accountId: string }).accountId;
}

async function runGitHubOwnershipIdempotently<T>(
  context: Context<BackendContext>,
  operation: "github-ownership-deactivate" | "github-ownership-reactivate",
  accountId: string,
  execute: (requestId: string) => Promise<T>,
): Promise<Response> {
  const pointsUserId = context.get("pointsUser").id;
  const idempotencyKey = context.req.header("Idempotency-Key")!;
  const payloadHash = await hashCanonicalPayload({ accountId });
  const db = requireBindings(context.env).DB;
  let ownsReservation = false;
  try {
    const reservation = await db
      .prepare(
        `INSERT OR IGNORE INTO idempotency_results
           (id, actor_points_user_id, operation, idempotency_key, payload_hash,
            status, response_body)
         VALUES (?, ?, ?, ?, ?, 102, '{"pending":true}')`,
      )
      .bind(`idemr_${crypto.randomUUID()}`, pointsUserId, operation, idempotencyKey, payloadHash)
      .run();
    ownsReservation = (reservation.meta.changes ?? 0) === 1;
    if (!ownsReservation) {
      const replay = await db
        .prepare(
          `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
             FROM idempotency_results
            WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?`,
        )
        .bind(pointsUserId, operation, idempotencyKey)
        .first<{ payloadHash: string; status: number; responseBody: string | object }>();
      if (!replay || replay.payloadHash !== payloadHash) {
        return problem(context, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused");
      }
      if (replay.status === 102) {
        return problem(context, 409, "IDEMPOTENCY_IN_PROGRESS", "Operation in progress");
      }
      const responseBody =
        typeof replay.responseBody === "string"
          ? (JSON.parse(replay.responseBody) as object)
          : replay.responseBody;
      return context.json(responseBody, replay.status as 200);
    }

    const requestId = `req_${crypto.randomUUID()}`;
    const responseBody = { data: await execute(requestId), meta: { requestId } };
    await db
      .prepare(
        `UPDATE idempotency_results SET status = 200, response_body = ?
          WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?
            AND payload_hash = ? AND status = 102`,
      )
      .bind(JSON.stringify(responseBody), pointsUserId, operation, idempotencyKey, payloadHash)
      .run();
    return context.json(responseBody);
  } catch (error) {
    if (ownsReservation) {
      await db
        .prepare(
          `DELETE FROM idempotency_results
            WHERE actor_points_user_id = ? AND operation = ? AND idempotency_key = ?
              AND payload_hash = ? AND status = 102`,
        )
        .bind(pointsUserId, operation, idempotencyKey, payloadHash)
        .run();
    }
    throw error;
  }
}

export function registerOwnershipRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  dependencies: {
    getGitHubAccessToken: GetGitHubAccessToken;
    githubRevokeFetch?: typeof fetch;
    webOwnershipFetch?: typeof fetch;
  },
) {
  const session = createSessionMiddleware(getSession);
  app.post(
    "/api/ownership/web/verify",
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return problem(context, 422, "WEB_OWNERSHIP_BODY_INVALID", "url is required");
      }
      if (
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        typeof (body as { url?: unknown }).url !== "string" ||
        (body as { url: string }).url.length === 0
      ) {
        return problem(context, 422, "WEB_OWNERSHIP_BODY_INVALID", "url is required");
      }
      const requestId = `req_${crypto.randomUUID()}`;
      const pointsUserId = context.get("pointsUser").id;
      const idempotencyKey = context.req.header("Idempotency-Key")!;
      const db = requireBindings(context.env).DB;
      let payloadHash: string | null = null;
      let ownsReservation = false;
      try {
        const normalizedUrl = normalizeIdentityUrl((body as { url: string }).url);
        payloadHash = await hashCanonicalPayload({ url: normalizedUrl });
        const reservation = await db
          .prepare(
            `INSERT OR IGNORE INTO idempotency_results
           (id, actor_points_user_id, operation, idempotency_key, payload_hash,
            status, response_body)
         VALUES (?, ?, 'web-ownership-verify', ?, ?, 102, '{"pending":true}')`,
          )
          .bind(`idemr_${crypto.randomUUID()}`, pointsUserId, idempotencyKey, payloadHash)
          .run();
        ownsReservation = (reservation.meta.changes ?? 0) === 1;
        if ((reservation.meta.changes ?? 0) === 0) {
          const replay = await db
            .prepare(
              `SELECT payload_hash AS payloadHash, status, response_body AS responseBody
           FROM idempotency_results
           WHERE actor_points_user_id = ? AND operation = 'web-ownership-verify'
             AND idempotency_key = ?`,
            )
            .bind(pointsUserId, idempotencyKey)
            .first<{ payloadHash: string; status: number; responseBody: string | object }>();
          if (!replay || replay.payloadHash !== payloadHash)
            return problem(context, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused");
          if (replay.status === 102)
            return problem(context, 409, "IDEMPOTENCY_IN_PROGRESS", "Verification in progress");
          const responseBody =
            typeof replay.responseBody === "string"
              ? (JSON.parse(replay.responseBody) as object)
              : replay.responseBody;
          return context.json(responseBody, replay.status as 200);
        }
        const result = await verifyWebOwnership(requireBindings(context.env), {
          fetchImpl: dependencies.webOwnershipFetch,
          pointsUserId,
          requestId,
          url: normalizedUrl,
        });
        const responseBody = { data: result, meta: { requestId } };
        await db
          .prepare(
            `UPDATE idempotency_results SET status = 200, response_body = ?
         WHERE actor_points_user_id = ? AND operation = 'web-ownership-verify'
           AND idempotency_key = ? AND payload_hash = ? AND status = 102`,
          )
          .bind(JSON.stringify(responseBody), pointsUserId, idempotencyKey, payloadHash)
          .run();
        return context.json(responseBody);
      } catch (error) {
        if (ownsReservation && payloadHash) {
          await db
            .prepare(
              `DELETE FROM idempotency_results
           WHERE actor_points_user_id = ? AND operation = 'web-ownership-verify'
             AND idempotency_key = ? AND payload_hash = ? AND status = 102`,
            )
            .bind(pointsUserId, idempotencyKey, payloadHash)
            .run();
        }
        if (error instanceof Error && error.message === "IDENTITY_URL_INVALID")
          return problem(context, 422, "WEB_URL_UNSAFE", "Web ownership verification failed");
        if (!(error instanceof WebOwnershipError)) throw error;
        const status = error.code === "WEB_OWNERSHIP_ALREADY_ACTIVE" ? 409 : 422;
        return problem(context, status, error.code, "Web ownership verification failed");
      }
    },
  );
  app.post(
    "/api/ownership/github/deactivate",
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      const accountId = await readGitHubAccountId(context);
      if (!accountId) {
        return problem(context, 422, "GITHUB_OWNERSHIP_BODY_INVALID", "accountId is required");
      }
      try {
        return await runGitHubOwnershipIdempotently(
          context,
          "github-ownership-deactivate",
          accountId,
          (requestId) =>
            deactivateGitHubOwnership(requireBindings(context.env), {
              accountId,
              authUserId: context.get("authSession").user.id,
              getAccessToken: dependencies.getGitHubAccessToken,
              githubFetch: dependencies.githubRevokeFetch,
              pointsUserId: context.get("pointsUser").id,
              requestId,
            }),
        );
      } catch (error) {
        return mapGitHubOwnershipError(context, error);
      }
    },
  );
  app.post(
    "/api/ownership/github/reactivate",
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      const accountId = await readGitHubAccountId(context);
      if (!accountId) {
        return problem(context, 422, "GITHUB_OWNERSHIP_BODY_INVALID", "accountId is required");
      }
      try {
        return await runGitHubOwnershipIdempotently(
          context,
          "github-ownership-reactivate",
          accountId,
          (requestId) =>
            reactivateGitHubOwnership(requireBindings(context.env), {
              accountId,
              authUserId: context.get("authSession").user.id,
              getAccessToken: dependencies.getGitHubAccessToken,
              pointsUserId: context.get("pointsUser").id,
              requestId,
            }),
        );
      } catch (error) {
        return mapGitHubOwnershipError(context, error);
      }
    },
  );
  app.get("/api/ownership/:identityOwnershipId/claim-preview", session, async (context) => {
    try {
      const preview = await previewUnclaimedFixes(
        requireBindings(context.env).DB,
        context.req.param("identityOwnershipId"),
        context.get("pointsUser").id,
      );
      return context.json({ data: preview, meta: { requestId: `req_${crypto.randomUUID()}` } });
    } catch (error) {
      return mapOwnershipError(context, error);
    }
  });
  app.post(
    "/api/ownership/:identityOwnershipId/claim",
    session,
    googleFreshMiddleware,
    idempotencyKeyMiddleware,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return problem(context, 422, "CLAIM_BODY_INVALID", "Claim body invalid");
      }
      if (
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        typeof (body as { claimSetHash?: unknown }).claimSetHash !== "string" ||
        !/^[a-f0-9]{64}$/.test((body as { claimSetHash: string }).claimSetHash)
      ) {
        return problem(context, 422, "CLAIM_BODY_INVALID", "Only claimSetHash is accepted");
      }
      try {
        const result = await claimUnclaimedFixes(requireBindings(context.env).DB, {
          claimSetHash: (body as { claimSetHash: string }).claimSetHash,
          idempotencyKey: context.req.header("Idempotency-Key")!,
          identityOwnershipId: context.req.param("identityOwnershipId"),
          now: new Date(),
          pointsUserId: context.get("pointsUser").id,
          requestId: `req_${crypto.randomUUID()}`,
        });
        return context.json(result.responseBody as object, result.status as 201);
      } catch (error) {
        if (error instanceof OwnershipClaimError && error.code === "CLAIM_SET_CHANGED") {
          const latest = await previewUnclaimedFixes(
            requireBindings(context.env).DB,
            context.req.param("identityOwnershipId"),
            context.get("pointsUser").id,
          );
          return context.json(
            {
              code: error.code,
              data: latest,
              status: 409,
              title: "Claim set changed",
              type: "https://points.freeism.app/problems/claim-set-changed",
            },
            409,
            { "Content-Type": "application/problem+json" },
          );
        }
        return mapOwnershipError(context, error);
      }
    },
  );
}
