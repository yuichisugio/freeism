import type { Bindings } from "../http/context";
import { createPointsAuth } from "./create-auth";

export type GetGitHubAccessToken = (
  env: Bindings,
  authUserId: string,
  accountId: string,
) => Promise<string | null>;

export const getGitHubAccessToken: GetGitHubAccessToken = async (env, authUserId, accountId) => {
  const result = await createPointsAuth(env).api.getAccessToken({
    body: { accountId, providerId: "github", userId: authUserId },
  });
  return result.accessToken || null;
};

export class GitHubTokenRevokeError extends Error {
  constructor() {
    super("GITHUB_TOKEN_REVOKE_FAILED");
  }
}

export async function revokeGitHubAccessToken(
  env: Bindings,
  accessToken: string,
  githubFetch: typeof fetch = fetch,
): Promise<void> {
  const credentials = btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`);
  const response = await githubFetch(
    new Request(
      `https://api.github.com/applications/${encodeURIComponent(env.GITHUB_CLIENT_ID)}/token`,
      {
        body: JSON.stringify({ access_token: accessToken }),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          "User-Agent": "freeism-points-worker",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        method: "DELETE",
      },
    ),
  );
  if (response.status !== 204 && response.status !== 404) {
    throw new GitHubTokenRevokeError();
  }
}
