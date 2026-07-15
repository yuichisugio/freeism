import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { releaseEnvironment } from "./migrate-d1.mjs";

export function smokeOrigin(environment) {
  return environment === "production"
    ? "https://markets.freeism.app"
    : "https://staging.markets.freeism.app";
}

export function smokeChecks() {
  return [
    { method: "GET", path: "/", expected: "html" },
    { method: "GET", path: "/terms", expected: "html" },
    { method: "GET", path: "/privacy", expected: "html" },
    { method: "GET", path: "/help", expected: "html" },
    { method: "GET", path: "/docs", expected: "html" },
    { method: "GET", path: "/api/health", expected: "json" },
    { method: "GET", path: "/api/auth/get-session", expected: "json" },
    { method: "GET", path: "/api/v1/auctions?limit=1", expected: "json" },
    { method: "GET", path: "/assets/__markets_smoke_missing__.js", expected: "missing" },
  ];
}

async function checkResponse(origin, check) {
  const url = new URL(check.path, origin);
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: check.expected === "html" ? "text/html" : "application/json" },
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${check.path}: redirects are forbidden in smoke checks`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (
    check.expected === "html" &&
    (response.status !== 200 || !contentType.includes("text/html"))
  ) {
    throw new Error(`${check.path}: expected HTML 200, received ${response.status} ${contentType}`);
  }
  if (
    check.expected === "json" &&
    (response.status !== 200 || !contentType.includes("application/json"))
  ) {
    throw new Error(`${check.path}: expected JSON 200, received ${response.status} ${contentType}`);
  }
  if (
    check.expected === "missing" &&
    (response.status !== 404 || contentType.includes("text/html"))
  ) {
    throw new Error(
      `${check.path}: expected non-HTML 404, received ${response.status} ${contentType}`,
    );
  }
}

export async function smoke(environment) {
  releaseEnvironment(environment);
  const origin = smokeOrigin(environment);
  for (const check of smokeChecks()) await checkResponse(origin, check);
  process.stdout.write(`Markets ${environment} read-only smoke: PASS\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await smoke(releaseEnvironment(process.argv[2]));
}
