import type { WorkflowStepConfig } from "cloudflare:workers";

export const SETTLEMENT_STEP_POLICIES = {
  validatePlan: {
    timeout: "30 seconds",
    retries: { limit: 1, delay: "1 second", backoff: "constant" },
  },
  reserveRound: {
    timeout: "5 minutes",
    retries: { limit: 3, delay: "1 second", backoff: "exponential" },
  },
  statusRound: {
    timeout: "30 seconds",
    retries: { limit: 3, delay: "1 second", backoff: "exponential" },
  },
  capture: {
    timeout: "2 minutes",
    retries: { limit: 5, delay: "2 seconds", backoff: "exponential" },
  },
  releaseRound: {
    timeout: "2 minutes",
    retries: { limit: 5, delay: "2 seconds", backoff: "exponential" },
  },
  finalize: {
    timeout: "1 minute",
    retries: { limit: 3, delay: "1 second", backoff: "exponential" },
  },
} as const satisfies Record<string, WorkflowStepConfig>;

export interface SettlementHttpPolicy {
  attemptTimeoutMs: number;
  backoff: "exponential";
  initialDelayMs: number;
  maxElapsedMs: number;
  retryableStatuses: readonly [429, 502, 503, 504];
  totalAttempts: number;
}

const retryableStatuses = [429, 502, 503, 504] as const;

export const SETTLEMENT_HTTP_POLICIES = {
  reserveWinner: {
    attemptTimeoutMs: 8_000,
    totalAttempts: 3,
    initialDelayMs: 1_000,
    backoff: "exponential",
    maxElapsedMs: 45_000,
    retryableStatuses,
  },
  status: {
    attemptTimeoutMs: 5_000,
    totalAttempts: 3,
    initialDelayMs: 1_000,
    backoff: "exponential",
    maxElapsedMs: 30_000,
    retryableStatuses,
  },
  capture: {
    attemptTimeoutMs: 10_000,
    totalAttempts: 5,
    initialDelayMs: 2_000,
    backoff: "exponential",
    maxElapsedMs: 120_000,
    retryableStatuses,
  },
  release: {
    attemptTimeoutMs: 5_000,
    totalAttempts: 5,
    initialDelayMs: 2_000,
    backoff: "exponential",
    maxElapsedMs: 120_000,
    retryableStatuses,
  },
  finalize: {
    attemptTimeoutMs: 10_000,
    totalAttempts: 3,
    initialDelayMs: 1_000,
    backoff: "exponential",
    maxElapsedMs: 60_000,
    retryableStatuses,
  },
} as const satisfies Record<string, SettlementHttpPolicy>;
