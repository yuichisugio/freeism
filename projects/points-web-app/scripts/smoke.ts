import { request as httpsRequest } from "node:https";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { releaseEnvironment, type ReleaseEnvironment } from "./migrate-d1";

type SmokeCheck = {
  path: string;
  expected: "html" | "json" | "navigation" | "unauthorized" | "basic-auth";
};

type SmokeResponse = {
  contentType: string;
  status: number;
  challenge?: string;
};

export function smokeOrigin(environment: ReleaseEnvironment): string {
  return environment === "production"
    ? "https://points.freeism.app"
    : "https://staging.points.freeism.app";
}

export function smokeChecks(environment: ReleaseEnvironment): SmokeCheck[] {
  const checks: SmokeCheck[] = [
    { path: "/", expected: "html" },
    { path: "/terms", expected: "html" },
    { path: "/privacy", expected: "html" },
    { path: "/help", expected: "html" },
    { path: "/docs", expected: "html" },
    { path: "/search", expected: "navigation" },
    { path: "/api/v1/search?q=__points_smoke__", expected: "json" },
    { path: "/api/auth/get-session", expected: "json" },
    { path: "/api/accounts-links", expected: "unauthorized" },
  ];
  return checks.map((check) =>
    environment === "staging" && (check.expected === "html" || check.expected === "navigation")
      ? { ...check, expected: "basic-auth" }
      : check,
  );
}

function requestNavigation(url: URL): Promise<SmokeResponse> {
  return new Promise((resolveRequest, rejectRequest) => {
    const request = httpsRequest(
      url,
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
        method: "GET",
      },
      (response) => {
        response.once("error", rejectRequest);
        response.resume();
        response.once("end", () => {
          const contentType = response.headers["content-type"];
          resolveRequest({
            contentType: Array.isArray(contentType) ? contentType.join(", ") : (contentType ?? ""),
            status: response.statusCode ?? 0,
          });
        });
      },
    );
    request.once("error", rejectRequest);
    request.end();
  });
}

async function checkResponse(origin: string, check: SmokeCheck): Promise<void> {
  const url = new URL(check.path, origin);
  const response =
    check.expected === "navigation"
      ? await requestNavigation(url)
      : await fetch(url, {
          headers: { accept: check.expected === "html" ? "text/html" : "application/json" },
          redirect: "manual",
        }).then((result) => ({
          contentType: result.headers.get("content-type") ?? "",
          status: result.status,
          challenge: result.headers.get("WWW-Authenticate") ?? "",
        }));
  if (check.expected === "basic-auth") {
    if (response.status !== 401 || !/^Basic\s/i.test(response.challenge ?? "")) {
      throw new Error(
        `${check.path}: expected Basic authentication 401, received ${response.status}`,
      );
    }
    return;
  }
  if (check.expected === "html" || check.expected === "navigation") {
    if (response.status !== 200 || !response.contentType.includes("text/html")) {
      throw new Error(
        `${check.path}: expected HTML 200, received ${response.status} ${response.contentType}`,
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
  if (response.status !== 200 || !response.contentType.includes("application/json")) {
    throw new Error(
      `${check.path}: expected JSON 200, received ${response.status} ${response.contentType}`,
    );
  }
}

export async function smoke(environment: ReleaseEnvironment): Promise<void> {
  const origin = smokeOrigin(environment);
  await smokeAt(origin, environment);
}

export async function smokeAt(origin: string, environment: ReleaseEnvironment): Promise<void> {
  for (const check of smokeChecks(environment)) await checkResponse(origin, check);
  process.stdout.write(`Points ${environment} read-only smoke at ${origin}: PASS\n`);
}

async function main(): Promise<void> {
  await smoke(releaseEnvironment(process.argv[2]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
