import type { GetGitHubAccessToken } from "../auth/github-identity-grant";
import type { Bindings } from "../http/context";
import { previewUnclaimedFixes } from "./preview-unclaimed-fixes";
import { findGitHubOwnershipContext, GitHubOwnershipError } from "./deactivate-github-ownership";

export async function reactivateGitHubOwnership(
  env: Bindings,
  input: {
    accountId: string;
    authUserId: string;
    getAccessToken: GetGitHubAccessToken;
    pointsUserId: string;
    requestId: string;
  },
) {
  const ownership = await findGitHubOwnershipContext(env.DB, input);
  let accessToken: string | null = null;
  try {
    accessToken = await input.getAccessToken(env, input.authUserId, input.accountId);
  } catch {
    // A successful explicit GitHub reauthorization must have produced a readable token.
  }
  if (!accessToken) throw new GitHubOwnershipError("GITHUB_REAUTH_REQUIRED");
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE identity_ownership SET status = 'ACTIVE', verified_at = ?
         WHERE id = ? AND points_user_id = ?`,
    ).bind(now, ownership.identityOwnershipId, input.pointsUserId),
    env.DB.prepare(
      `INSERT INTO audit_event
           (id, actor_points_user_id, action, target, request_id, result, created_at)
         VALUES (?, ?, 'GITHUB_OWNERSHIP_REACTIVATE', ?, ?, 'SUCCESS', ?)`,
    ).bind(
      `audit_${crypto.randomUUID()}`,
      input.pointsUserId,
      ownership.identityOwnershipId,
      input.requestId,
      now,
    ),
  ]);
  const claimPreview = await previewUnclaimedFixes(
    env.DB,
    ownership.identityOwnershipId,
    input.pointsUserId,
  );
  return {
    accountId: input.accountId,
    claimPreview,
    identityOwnershipId: ownership.identityOwnershipId,
    status: "ACTIVE" as const,
  };
}
