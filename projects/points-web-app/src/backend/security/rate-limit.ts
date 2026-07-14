export const pointsRateLimitPolicies = {
  CSV_CRITERION_HOURLY: { limit: 10, windowSeconds: 60 * 60 },
  CSV_CRITERION_MINUTE: { limit: 2, windowSeconds: 60 },
  OWNERSHIP_IDENTITY_HOURLY: { limit: 5, windowSeconds: 60 * 60 },
  OWNERSHIP_USER_DAILY: { limit: 30, windowSeconds: 24 * 60 * 60 },
} as const;

export type PointsRateLimitOperation = keyof typeof pointsRateLimitPolicies;

export interface ConsumePointsRateLimitInput {
  db: D1Database;
  now?: number;
  operation: PointsRateLimitOperation;
  subjectParts: readonly string[];
}

export interface PointsRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumePointsRateLimit(
  input: ConsumePointsRateLimitInput,
): Promise<PointsRateLimitResult> {
  if (input.subjectParts.length === 0 || input.subjectParts.some((part) => part.length === 0)) {
    throw new Error("Rate limit subject parts must be non-empty");
  }

  const policy = pointsRateLimitPolicies[input.operation];
  const now = Math.trunc(input.now ?? Date.now());
  const windowMilliseconds = policy.windowSeconds * 1_000;
  const windowStartedAt = Math.floor(now / windowMilliseconds) * windowMilliseconds;
  const resetAt = windowStartedAt + windowMilliseconds;
  const subjectKeyHash = await sha256Hex(JSON.stringify(input.subjectParts));

  const row = await input.db
    .prepare(
      `INSERT INTO app_rate_limit_window
         (operation, subject_key_hash, window_started_at, window_seconds,
          request_count, updated_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(operation, subject_key_hash, window_started_at)
       DO UPDATE SET
         request_count = app_rate_limit_window.request_count + 1,
         updated_at = excluded.updated_at
       WHERE app_rate_limit_window.request_count < ?
       RETURNING request_count AS requestCount`,
    )
    .bind(input.operation, subjectKeyHash, windowStartedAt, policy.windowSeconds, now, policy.limit)
    .first<{ requestCount: number }>();

  const allowed = row !== null;
  const requestCount = row?.requestCount ?? policy.limit;
  return {
    allowed,
    limit: policy.limit,
    remaining: allowed ? Math.max(0, policy.limit - requestCount) : 0,
    resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - now) / 1_000)),
  };
}
