import type { GitHubRateLimitObservation } from "./github-profile-recipient-resolver";

const BUDGET_ID = "github-user-lookup";
const DEFAULT_LIMIT = 5_000;
const DEFAULT_WINDOW_SECONDS = 3_600;

export class GitHubApiBudgetError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("GITHUB_IDENTITY_LOOKUP_RATE_LIMITED");
  }
}

export async function reserveGitHubApiBudget(
  db: D1Database,
  count: number,
  now = new Date(),
): Promise<void> {
  if (!Number.isSafeInteger(count) || count < 0 || count > 1_000) {
    throw new Error("GITHUB_IDENTITY_LOOKUP_COUNT_INVALID");
  }
  if (count === 0) return;
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  await db
    .prepare(
      `INSERT INTO github_api_budget (id, remaining, reset_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .bind(BUDGET_ID, DEFAULT_LIMIT, nowSeconds + DEFAULT_WINDOW_SECONDS, now.getTime())
    .run();
  const reserved = await db
    .prepare(
      `UPDATE github_api_budget
       SET remaining = CASE WHEN reset_at <= ? THEN ? - ? ELSE remaining - ? END,
           reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END,
           updated_at = ?
       WHERE id = ?
         AND (CASE WHEN reset_at <= ? THEN ? ELSE remaining END) >= ?`,
    )
    .bind(
      nowSeconds,
      DEFAULT_LIMIT,
      count,
      count,
      nowSeconds,
      nowSeconds + DEFAULT_WINDOW_SECONDS,
      now.getTime(),
      BUDGET_ID,
      nowSeconds,
      DEFAULT_LIMIT,
      count,
    )
    .run();
  if (reserved.meta.changes !== 1) {
    const row = await db
      .prepare("SELECT reset_at AS resetAt FROM github_api_budget WHERE id = ?")
      .bind(BUDGET_ID)
      .first<{ resetAt: number }>();
    throw new GitHubApiBudgetError(Math.max(1, (row?.resetAt ?? nowSeconds + 1) - nowSeconds));
  }
}

export async function observeGitHubApiBudget(
  db: D1Database,
  observation: GitHubRateLimitObservation,
  now = new Date(),
): Promise<void> {
  if (observation.remaining === null && observation.resetAtSeconds === null) return;
  await db
    .prepare(
      `UPDATE github_api_budget
       SET remaining = CASE
             WHEN ? IS NULL THEN remaining
             WHEN ? < remaining THEN ?
             ELSE remaining
           END,
           reset_at = COALESCE(?, reset_at),
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      observation.remaining,
      observation.remaining,
      observation.remaining,
      observation.resetAtSeconds,
      now.getTime(),
      BUDGET_ID,
    )
    .run();
}
