export const marketsMetricSignals = [
  "HTTP_REJECTION",
  "IDEMPOTENCY_CONFLICT",
  "D1_BATCH_FAILURE",
] as const;

export type MarketsMetricSignal = (typeof marketsMetricSignals)[number];

export function createMarketsMetric(signal: MarketsMetricSignal, value = 1) {
  return { signal, value } as const;
}
