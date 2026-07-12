import { access, readFile } from "node:fs/promises";
import path from "node:path";

const HTML_ARTIFACTS = ["index.html", "terms.html", "privacy.html", "help.html", "docs.html"];

export async function findGeneratedWorkerConfig(appPath) {
  const root = path.resolve(appPath);
  const candidates = [
    path.join(root, "dist", "server", "wrangler.json"),
    path.join(root, "dist", "wrangler.json"),
  ];
  const configs = [];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      configs.push(candidate);
    } catch {
      // Continue to the other known output location.
    }
  }

  if (configs.length !== 1) {
    throw new Error(`expected one generated wrangler.json, found ${configs.length}`);
  }
  return configs[0];
}

export async function assertWorkerBuild(appPath, expectedEnvironment, expectedName) {
  const configPath = await findGeneratedWorkerConfig(appPath);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (expectedEnvironment && config.vars?.APP_ENV !== expectedEnvironment) {
    throw new Error(`expected APP_ENV ${expectedEnvironment}, received ${config.vars?.APP_ENV}`);
  }
  if (expectedName && config.name !== expectedName) {
    throw new Error(`expected Worker ${expectedName}, received ${config.name}`);
  }
  if (config.assets?.not_found_handling !== "none") {
    throw new Error("generated config must use assets.not_found_handling=none");
  }
  if (config.assets?.html_handling !== "auto-trailing-slash") {
    throw new Error("generated config must use assets.html_handling=auto-trailing-slash");
  }
  if (config.workers_dev !== false || config.preview_urls !== false) {
    throw new Error("workers.dev and preview URLs must remain disabled");
  }
  for (const flag of [
    "nodejs_compat",
    "assets_navigation_has_no_effect",
    "global_fetch_strictly_public",
  ]) {
    if (!config.compatibility_flags?.includes(flag)) {
      throw new Error(`generated config is missing compatibility flag: ${flag}`);
    }
  }

  const assetsDirectory = path.resolve(path.dirname(configPath), config.assets.directory);
  for (const artifact of HTML_ARTIFACTS) {
    await access(path.join(assetsDirectory, artifact));
  }
  const headers = await readFile(path.join(assetsDirectory, "_headers"), "utf8");
  if (headers.includes("unsafe-eval") || /script-src[^;]*'unsafe-inline'/.test(headers)) {
    throw new Error("generated CSP contains a forbidden script source");
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await assertWorkerBuild(process.argv[2], process.argv[3], process.argv[4]);
}
