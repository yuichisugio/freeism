import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assertDrillEnvironment(value: string | undefined): asserts value is "staging" {
  if (value !== "staging") {
    throw new Error("ops alert drill is allowed only in staging");
  }
}

type DrillResponse = {
  correlationId?: string;
  alertKey?: string;
  status?: string;
  evidence?: unknown;
};

async function postPhase(
  phase: "OPEN" | "DEDUPE" | "RESOLVED",
  correlationId: string,
  token: string,
): Promise<DrillResponse> {
  const response = await fetch("https://staging.points.freeism.app/api/internal/ops-alert-drill", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
    body: JSON.stringify({ phase }),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`ops alert drill ${phase} failed: HTTP ${response.status}`);
  return (await response.json()) as DrillResponse;
}

export async function drillOpsAlert(environment: "staging"): Promise<void> {
  assertDrillEnvironment(environment);
  const token = process.env.POINTS_OPS_DRILL_TOKEN;
  if (!token) throw new Error("POINTS_OPS_DRILL_TOKEN is required");
  const correlationId = randomUUID();
  const phases = ["OPEN", "DEDUPE", "RESOLVED"] as const;
  const evidence: DrillResponse[] = [];
  for (const phase of phases) {
    const result = await postPhase(phase, correlationId, token);
    if (result.correlationId !== correlationId || result.status !== phase) {
      throw new Error(`ops alert drill ${phase} returned inconsistent evidence`);
    }
    evidence.push(result);
  }
  process.stdout.write(`${JSON.stringify({ correlationId, evidence }, null, 2)}\n`);
}

async function main(): Promise<void> {
  assertDrillEnvironment(process.argv[2]);
  await drillOpsAlert("staging");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
