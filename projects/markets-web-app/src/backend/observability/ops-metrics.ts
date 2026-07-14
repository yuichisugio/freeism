export const marketsMetricSignals = [
  "HTTP_REJECTION",
  "IDEMPOTENCY_CONFLICT",
  "D1_BATCH_FAILURE",
] as const;

export type MarketsMetricSignal = (typeof marketsMetricSignals)[number];

export function createMarketsMetric(signal: MarketsMetricSignal, value = 1) {
  return { signal, value } as const;
}

export interface OpsMetricInput {
  app: "markets";
  attempt: number;
  code: string;
  count: number;
  durationMs: number;
  environment: string;
  event: string;
  lagSeconds: number;
  outcome: string;
  resourceIdHash: string;
  resourceState: string;
}

export function emitOpsMetric(dataset: AnalyticsEngineDataset, input: OpsMetricInput): boolean {
  try {
    dataset.writeDataPoint({
      blobs: [
        input.event,
        input.app,
        input.environment,
        input.outcome,
        input.code,
        input.resourceState,
      ],
      doubles: [input.count, input.durationMs, input.lagSeconds, input.attempt],
      indexes: [input.resourceIdHash],
    });
    return true;
  } catch {
    return false;
  }
}

export async function hashOpsResourceId(resourceId: string, salt: string): Promise<string> {
  if (salt.length === 0) throw new Error("Ops resource hash salt is required");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${resourceId}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
