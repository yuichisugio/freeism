import type { GetGitHubAccessToken } from "../auth/github-identity-grant";
import { GitHubTokenRevokeError, revokeGitHubAccessToken } from "../auth/github-identity-grant";
import type { Bindings } from "../http/context";

export class GitHubOwnershipError extends Error {
  constructor(
    readonly code:
      | "GITHUB_ACCOUNT_NOT_LINKED"
      | "GITHUB_ACCOUNT_CHANGED"
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
  accessToken: string | null;
  hasStoredToken: boolean;
  idToken: string | null;
  identityOwnershipId: string;
  pointsUserId: string;
  refreshToken: string | null;
  status: string;
  updatedAt: number;
}

export async function findGitHubOwnershipContext(
  db: D1Database,
  input: { accountId: string; authUserId: string; pointsUserId: string },
): Promise<GitHubOwnershipContext> {
  const account = await db
    .prepare(
      `SELECT id, access_token AS accessToken, refresh_token AS refreshToken,
              id_token AS idToken, updated_at AS updatedAt,
              CASE WHEN access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL
                THEN 1 ELSE 0 END AS hasStoredToken
       FROM account
       WHERE user_id = ? AND provider_id = 'github' AND account_id = ?`,
    )
    .bind(input.authUserId, input.accountId)
    .first<{
      accessToken: string | null;
      hasStoredToken: number;
      idToken: string | null;
      refreshToken: string | null;
      updatedAt: number;
    }>();
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
  return { ...ownership, ...account, hasStoredToken: account.hasStoredToken === 1 };
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ownership = await findGitHubOwnershipContext(env.DB, input);
    if (ownership.hasStoredToken) {
      let accessToken: string | null = null;
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
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE account
           SET access_token = NULL, refresh_token = NULL, id_token = NULL, updated_at = ?
           WHERE user_id = ? AND provider_id = 'github' AND account_id = ?
             AND updated_at = ? AND access_token IS ? AND refresh_token IS ? AND id_token IS ?`,
      ).bind(
        now,
        input.authUserId,
        input.accountId,
        ownership.updatedAt,
        ownership.accessToken,
        ownership.refreshToken,
        ownership.idToken,
      ),
      env.DB.prepare(
        `UPDATE identity_ownership SET status = 'INACTIVE'
           WHERE id = ? AND points_user_id = ?
             AND EXISTS (
               SELECT 1 FROM account
               WHERE user_id = ? AND provider_id = 'github' AND account_id = ?
                 AND updated_at = ? AND access_token IS NULL
                 AND refresh_token IS NULL AND id_token IS NULL
             )`,
      ).bind(
        ownership.identityOwnershipId,
        input.pointsUserId,
        input.authUserId,
        input.accountId,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO audit_event
             (id, actor_points_user_id, action, target, request_id, result, created_at)
           SELECT ?, ?, 'GITHUB_OWNERSHIP_DEACTIVATE', ?, ?, 'SUCCESS', ?
           WHERE EXISTS (
             SELECT 1 FROM account
             WHERE user_id = ? AND provider_id = 'github' AND account_id = ?
               AND updated_at = ? AND access_token IS NULL
               AND refresh_token IS NULL AND id_token IS NULL
           )`,
      ).bind(
        `audit_${crypto.randomUUID()}`,
        input.pointsUserId,
        ownership.identityOwnershipId,
        input.requestId,
        now,
        input.authUserId,
        input.accountId,
        now,
      ),
    ]);
    if (results[0]?.meta.changes === 1) {
      return {
        accountId: input.accountId,
        identityOwnershipId: ownership.identityOwnershipId,
        status: "INACTIVE" as const,
      };
    }
  }
  throw new GitHubOwnershipError("GITHUB_ACCOUNT_CHANGED");
}
