import type { GetGitHubAccessToken } from "../auth/github-identity-grant";
import { GitHubTokenRevokeError, revokeGitHubAccessToken } from "../auth/github-identity-grant";
import type { Bindings } from "../http/context";

export class GitHubOwnershipError extends Error {
  constructor(
    readonly code:
      | "GITHUB_ACCOUNT_NOT_LINKED"
      | "GITHUB_OWNERSHIP_NOT_FOUND"
      | "GITHUB_REAUTH_REQUIRED"
      | "GITHUB_SUBJECT_MISMATCH"
      | "GITHUB_TOKEN_ACCESS_FAILED"
      | "GITHUB_TOKEN_REVOKE_FAILED",
  ) {
    super(code);
  }
}

interface GitHubOwnershipContext {
  hasStoredToken: boolean;
  identityOwnershipId: string;
  pointsUserId: string;
  status: string;
}

export async function findGitHubOwnershipContext(
  db: D1Database,
  input: { accountId: string; authUserId: string; pointsUserId: string },
): Promise<GitHubOwnershipContext> {
  const account = await db
    .prepare(
      `SELECT id,
              CASE WHEN access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL
                THEN 1 ELSE 0 END AS hasStoredToken
       FROM account
       WHERE user_id = ? AND provider_id = 'github' AND account_id = ?`,
    )
    .bind(input.authUserId, input.accountId)
    .first<{ hasStoredToken: number }>();
  if (!account) throw new GitHubOwnershipError("GITHUB_ACCOUNT_NOT_LINKED");
  const subject = await db
    .prepare(
      `SELECT points_user_id AS pointsUserId FROM permanent_oauth_subject
       WHERE provider_id = 'github' AND account_id = ?`,
    )
    .bind(input.accountId)
    .first<{ pointsUserId: string }>();
  if (!subject || subject.pointsUserId !== input.pointsUserId) {
    throw new GitHubOwnershipError("GITHUB_SUBJECT_MISMATCH");
  }
  const ownership = await db
    .prepare(
      `SELECT id AS identityOwnershipId, points_user_id AS pointsUserId, status
       FROM identity_ownership
       WHERE identity_type = 'GITHUB_OAUTH' AND normalized_identity_key = ?`,
    )
    .bind(`github:${input.accountId}`)
    .first<GitHubOwnershipContext>();
  if (!ownership || ownership.pointsUserId !== input.pointsUserId) {
    throw new GitHubOwnershipError("GITHUB_OWNERSHIP_NOT_FOUND");
  }
  return { ...ownership, hasStoredToken: account.hasStoredToken === 1 };
}

export async function deactivateGitHubOwnership(
  env: Bindings,
  input: {
    accountId: string;
    authUserId: string;
    getAccessToken: GetGitHubAccessToken;
    githubFetch?: typeof fetch;
    pointsUserId: string;
    requestId: string;
  },
) {
  const ownership = await findGitHubOwnershipContext(env.DB, input);
  let accessToken: string | null = null;
  if (ownership.hasStoredToken) {
    try {
      accessToken = await input.getAccessToken(env, input.authUserId, input.accountId);
    } catch {
      throw new GitHubOwnershipError("GITHUB_TOKEN_ACCESS_FAILED");
    }
    if (!accessToken) throw new GitHubOwnershipError("GITHUB_TOKEN_ACCESS_FAILED");
    try {
      await revokeGitHubAccessToken(env, accessToken, input.githubFetch);
    } catch (error) {
      if (error instanceof GitHubTokenRevokeError) {
        throw new GitHubOwnershipError("GITHUB_TOKEN_REVOKE_FAILED");
      }
      throw error;
    }
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE account
         SET access_token = NULL, refresh_token = NULL, id_token = NULL, updated_at = ?
         WHERE user_id = ? AND provider_id = 'github' AND account_id = ?`,
    ).bind(now, input.authUserId, input.accountId),
    env.DB.prepare(
      `UPDATE identity_ownership SET status = 'INACTIVE'
         WHERE id = ? AND points_user_id = ?`,
    ).bind(ownership.identityOwnershipId, input.pointsUserId),
    env.DB.prepare(
      `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, request_id, result, created_at)
         VALUES (?, ?, 'GITHUB_OWNERSHIP_DEACTIVATE', ?, ?, 'SUCCESS', ?)`,
    ).bind(
      `audit_${crypto.randomUUID()}`,
      input.pointsUserId,
      ownership.identityOwnershipId,
      input.requestId,
      now,
    ),
  ]);
  return {
    accountId: input.accountId,
    identityOwnershipId: ownership.identityOwnershipId,
    status: "INACTIVE" as const,
  };
}
