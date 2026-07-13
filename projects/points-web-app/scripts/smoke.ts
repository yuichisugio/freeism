import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { releaseEnvironment, type ReleaseEnvironment } from "./migrate-d1";

type SmokeCheck = {
  path: string;
  expected: "html" | "json" | "unauthorized";
};

export function smokeOrigin(environment: ReleaseEnvironment): string {
  return environment === "production"
    ? "https://points.freeism.app"
    : "https://staging.points.freeism.app";
}

export function smokeChecks(): SmokeCheck[] {
  return [
    { path: "/", expected: "html" },
    { path: "/terms", expected: "html" },
    { path: "/privacy", expected: "html" },
    { path: "/help", expected: "html" },
    { path: "/docs", expected: "html" },
    { path: "/search", expected: "html" },
    { path: "/api/v1/search?q=__points_smoke__", expected: "json" },
    { path: "/api/auth/get-session", expected: "json" },
    { path: "/api/reconciliation", expected: "unauthorized" },
  ];
}

async function checkResponse(origin: string, check: SmokeCheck): Promise<void> {
  const response = await fetch(new URL(check.path, origin), {
    headers: { accept: check.expected === "html" ? "text/html" : "application/json" },
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (check.expected === "html") {
    if (response.status !== 200 || !contentType.includes("text/html")) {
      throw new Error(
        `${check.path}: expected HTML 200, received ${response.status} ${contentType}`,
      );
    }
    return;
  }
  if (check.expected === "unauthorized") {
    if (response.status !== 401 && response.status !== 403) {
      throw new Error(
        `${check.path}: expected an authentication rejection, received ${response.status}`,
      );
    }
    return;
  }
  if (response.status !== 200 || !contentType.includes("application/json")) {
    throw new Error(`${check.path}: expected JSON 200, received ${response.status} ${contentType}`);
  }
}

export async function smoke(environment: ReleaseEnvironment): Promise<void> {
  const origin = smokeOrigin(environment);
  for (const check of smokeChecks()) await checkResponse(origin, check);
  process.stdout.write(`Points ${environment} read-only smoke: PASS\n`);
}

async function main(): Promise<void> {
  await smoke(releaseEnvironment(process.argv[2]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
