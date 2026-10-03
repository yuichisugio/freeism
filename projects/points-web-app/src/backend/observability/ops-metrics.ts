export interface OpsMetricInput {
  app: "markets" | "points";
  attempt: number;
  code: string;
  count: number;
  durationMs: number;
  environment: string;
  event: string;
  lagSeconds: number;
  outcome: string;
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
      indexes: [input.event],
    });
    return true;
  } catch {
    return false;
  }
}
