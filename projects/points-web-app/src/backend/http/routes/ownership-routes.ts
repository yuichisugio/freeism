import type { Context, Hono } from "hono";

import type { GetGitHubAccessToken } from "../../auth/github-identity-grant";
import { claimUnclaimedFixes, OwnershipClaimError } from "../../usecases/claim-unclaimed-fixes";
import {
  deactivateGitHubOwnership,
  GitHubOwnershipError,
} from "../../usecases/deactivate-github-ownership";
import { previewUnclaimedFixes } from "../../usecases/preview-unclaimed-fixes";
import { reactivateGitHubOwnership } from "../../usecases/reactivate-github-ownership";
import type { BackendContext } from "../context";
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

export function registerOwnershipRoutes(
  app: Hono<BackendContext>,
  getSession: GetSession,
  dependencies: {
    getGitHubAccessToken: GetGitHubAccessToken;
    githubRevokeFetch?: typeof fetch;
  },
) {
  const session = createSessionMiddleware(getSession);
  app.post("/api/ownership/github/deactivate", session, googleFreshMiddleware, async (context) => {
    const accountId = await readGitHubAccountId(context);
    if (!accountId) {
      return problem(context, 422, "GITHUB_OWNERSHIP_BODY_INVALID", "accountId is required");
    }
    try {
      const result = await deactivateGitHubOwnership(requireBindings(context.env), {
        accountId,
        authUserId: context.get("authSession").user.id,
        getAccessToken: dependencies.getGitHubAccessToken,
        githubFetch: dependencies.githubRevokeFetch,
        pointsUserId: context.get("pointsUser").id,
        requestId: `req_${crypto.randomUUID()}`,
      });
      return context.json({ data: result, meta: { requestId: `req_${crypto.randomUUID()}` } });
    } catch (error) {
      return mapGitHubOwnershipError(context, error);
    }
  });
  app.post("/api/ownership/github/reactivate", session, googleFreshMiddleware, async (context) => {
    const accountId = await readGitHubAccountId(context);
    if (!accountId) {
      return problem(context, 422, "GITHUB_OWNERSHIP_BODY_INVALID", "accountId is required");
    }
    try {
      const result = await reactivateGitHubOwnership(requireBindings(context.env), {
        accountId,
        authUserId: context.get("authSession").user.id,
        getAccessToken: dependencies.getGitHubAccessToken,
        pointsUserId: context.get("pointsUser").id,
        requestId: `req_${crypto.randomUUID()}`,
      });
      return context.json({ data: result, meta: { requestId: `req_${crypto.randomUUID()}` } });
    } catch (error) {
      return mapGitHubOwnershipError(context, error);
    }
  });
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
