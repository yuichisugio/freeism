import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { assertGeneratedConfig } from "./deploy-generated";
import { findGeneratedWorkerConfig } from "./generated-worker-config";

const STAGING_WORKER = "points-worker-staging";
const STAGING_DB_ID = "c3859cf6-2786-4191-bffe-cd04331c228e";

type PreviewConfig = {
  name?: string;
  targetEnvironment?: string;
  preview_urls?: boolean;
  vars?: {
    APP_ENV?: string;
    APP_HOST?: string;
    APP_ORIGIN?: string;
    OAUTH_PROXY_PRODUCTION_URL?: string;
    PREVIEW_WORKERS_SUBDOMAIN?: string;
  };
  assets?: { directory?: string; not_found_handling?: string; html_handling?: string };
  d1_databases?: Array<{ binding?: string; database_id?: string }>;
};

function prNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("invalid PR number");
  return value;
}

export function previewName(number: number): string {
  return `points-pr-${prNumber(number)}`;
}

export function previewOrigin(number: number, subdomain: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
    throw new Error("invalid workers.dev subdomain");
  }
  return `https://${previewName(number)}-${STAGING_WORKER}.${subdomain}.workers.dev`;
}

export function assertPreviewConfig(config: PreviewConfig, subdomain: string): void {
  assertGeneratedConfig(config, "staging");
  if (
    config.name !== STAGING_WORKER ||
    config.preview_urls !== true ||
    config.vars?.APP_HOST !== "staging.points.freeism.app" ||
    config.vars?.APP_ORIGIN !== "https://staging.points.freeism.app" ||
    !config.assets?.directory
  ) {
    throw new Error("Version URL must use the generated staging Worker and assets");
  }
  if (
    config.vars?.PREVIEW_WORKERS_SUBDOMAIN !== subdomain ||
    config.vars?.OAUTH_PROXY_PRODUCTION_URL !== "https://staging.points.freeism.app"
  ) {
    throw new Error("Version URL subdomain or OAuth Proxy callback does not match staging");
  }
  if (config.d1_databases?.find((db) => db.binding === "DB")?.database_id !== STAGING_DB_ID) {
    throw new Error("Version URL must share staging D1");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const appRoot = resolve(dirname(import.meta.filename), "..");
  const configPath = await findGeneratedWorkerConfig(appRoot);
  const config = JSON.parse(await readFile(configPath, "utf8")) as PreviewConfig;
  assertPreviewConfig(config, process.argv[2] ?? "");
}
