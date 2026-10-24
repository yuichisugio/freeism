export type StructuredLogLevel = "debug" | "error" | "info" | "warn";

export interface StructuredLogInput {
  app: "markets" | "points";
  attempt?: number;
  affectedCount?: number;
  claimedCount?: number;
  code: string;
  correlationId?: string;
  durationMs?: number;
  environment: string;
  event: string;
  level: StructuredLogLevel;
  operation: string;
  outcome: string;
  requestId?: string;
  releasedLinkCount?: number;
  resourceType?: string;
  previousState?: string;
  nextState?: string;
  timestamp?: string;
}

const OPTIONAL_FIELDS = [
  "attempt",
  "correlationId",
  "durationMs",
  "requestId",
  "resourceType",
  "timestamp",
  "affectedCount",
  "claimedCount",
  "releasedLinkCount",
  "previousState",
  "nextState",
] as const;

export function createStructuredLog(
  input: StructuredLogInput & Record<string, unknown>,
): StructuredLogInput {
  const log: StructuredLogInput = {
    app: input.app,
    code: input.code,
    environment: input.environment,
    event: input.event,
    level: input.level,
    operation: input.operation,
    outcome: input.outcome,
  };
  for (const field of OPTIONAL_FIELDS) {
    const value = input[field];
    if (value !== undefined) Object.assign(log, { [field]: value });
  }
  return log;
}

export function writeStructuredLog(
  input: StructuredLogInput & Record<string, unknown>,
  sink: (log: StructuredLogInput) => void = console.log,
): void {
  sink(createStructuredLog(input));
}
