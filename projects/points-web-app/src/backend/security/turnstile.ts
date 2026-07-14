const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;
const TURNSTILE_TOKEN_LIFETIME_MS = 5 * 60 * 1_000;

export const pointsTurnstileActions = {
  CLAIM: "points_claim",
  CSV: "points_csv",
  OAUTH_START: "points_oauth_start",
  OWNERSHIP_VERIFY: "points_ownership_verify",
} as const;

export type PointsTurnstileOperation = keyof typeof pointsTurnstileActions;

export type TurnstileRejectionCode =
  | "TURNSTILE_ACTION_MISMATCH"
  | "TURNSTILE_HOSTNAME_MISMATCH"
  | "TURNSTILE_INVALID"
  | "TURNSTILE_PROVIDER_UNAVAILABLE"
  | "TURNSTILE_TOKEN_EXPIRED"
  | "TURNSTILE_TOKEN_REPLAYED";

export type AdaptiveTurnstileResult =
  | { status: "NOT_REQUIRED" }
  | { action: string; siteKey: string; status: "REQUIRED" }
  | { status: "VERIFIED" }
  | { code: TurnstileRejectionCode; status: "REJECTED" };

export interface EnforceAdaptiveTurnstileInput {
  db: D1Database;
  expectedHostname: string;
  now?: number;
  operation: PointsTurnstileOperation;
  remoteIp?: string;
  riskDetected: boolean;
  secret: string;
  siteKey: string;
  token?: string;
}

interface SiteverifyResult {
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  success?: boolean;
}

function isSiteverifyResult(value: unknown): value is SiteverifyResult {
  return typeof value === "object" && value !== null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceAdaptiveTurnstile(
  input: EnforceAdaptiveTurnstileInput,
  siteverifyFetch: typeof fetch = fetch,
): Promise<AdaptiveTurnstileResult> {
  if (!input.riskDetected) {
    return { status: "NOT_REQUIRED" };
  }

  const action = pointsTurnstileActions[input.operation];
  if (input.token === undefined) {
    if (input.siteKey.length === 0) {
      return { code: "TURNSTILE_PROVIDER_UNAVAILABLE", status: "REJECTED" };
    }
    return { action, siteKey: input.siteKey, status: "REQUIRED" };
  }

  if (
    input.secret.length === 0 ||
    input.token.length === 0 ||
    input.token.length > TURNSTILE_TOKEN_MAX_LENGTH
  ) {
    return { code: "TURNSTILE_INVALID", status: "REJECTED" };
  }

  const body = new FormData();
  body.set("secret", input.secret);
  body.set("response", input.token);
  if (input.remoteIp !== undefined) {
    body.set("remoteip", input.remoteIp);
  }

  let result: SiteverifyResult;
  try {
    const response = await siteverifyFetch(SITEVERIFY_URL, { body, method: "POST" });
    if (!response.ok) {
      return { code: "TURNSTILE_PROVIDER_UNAVAILABLE", status: "REJECTED" };
    }
    const value: unknown = await response.json();
    if (!isSiteverifyResult(value)) {
      return { code: "TURNSTILE_PROVIDER_UNAVAILABLE", status: "REJECTED" };
    }
    result = value;
  } catch {
    return { code: "TURNSTILE_PROVIDER_UNAVAILABLE", status: "REJECTED" };
  }

  if (result.success !== true) {
    return { code: "TURNSTILE_INVALID", status: "REJECTED" };
  }
  if (result.hostname?.toLowerCase() !== input.expectedHostname.toLowerCase()) {
    return { code: "TURNSTILE_HOSTNAME_MISMATCH", status: "REJECTED" };
  }
  if (result.action !== action) {
    return { code: "TURNSTILE_ACTION_MISMATCH", status: "REJECTED" };
  }

  const challengedAt = Date.parse(result.challenge_ts ?? "");
  const now = Math.trunc(input.now ?? Date.now());
  const tokenAge = now - challengedAt;
  if (!Number.isFinite(challengedAt) || tokenAge < 0 || tokenAge >= TURNSTILE_TOKEN_LIFETIME_MS) {
    return { code: "TURNSTILE_TOKEN_EXPIRED", status: "REJECTED" };
  }

  const tokenHash = await sha256Hex(input.token);
  const replayResult = await input.db
    .prepare(
      `INSERT INTO turnstile_token_replay
         (token_hash, operation, hostname, action, expires_at, used_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(token_hash) DO NOTHING`,
    )
    .bind(
      tokenHash,
      input.operation,
      input.expectedHostname.toLowerCase(),
      action,
      challengedAt + TURNSTILE_TOKEN_LIFETIME_MS,
      now,
    )
    .run();

  if (replayResult.meta.changes !== 1) {
    return { code: "TURNSTILE_TOKEN_REPLAYED", status: "REJECTED" };
  }
  return { status: "VERIFIED" };
}
