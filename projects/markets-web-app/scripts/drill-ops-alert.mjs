import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assertDrillEnvironment(value) {
  if (value !== "staging") throw new Error("ops alert drill is allowed only in staging");
}

async function postPhase(phase, correlationId, token) {
  const response = await fetch("https://staging.markets.freeism.app/api/internal/ops-alert-drill", {
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
  return response.json();
}

export async function drillOpsAlert(environment) {
  assertDrillEnvironment(environment);
  const token = process.env.MARKETS_OPS_DRILL_TOKEN;
  if (!token) throw new Error("MARKETS_OPS_DRILL_TOKEN is required");
  const correlationId = randomUUID();
  const evidence = [];
  for (const phase of ["OPEN", "DEDUPE", "RESOLVED"]) {
    const result = await postPhase(phase, correlationId, token);
    if (result.correlationId !== correlationId || result.status !== phase) {
      throw new Error(`ops alert drill ${phase} returned inconsistent evidence`);
    }
    evidence.push(result);
  }
  process.stdout.write(`${JSON.stringify({ correlationId, evidence }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assertDrillEnvironment(process.argv[2]);
  await drillOpsAlert("staging");
}
