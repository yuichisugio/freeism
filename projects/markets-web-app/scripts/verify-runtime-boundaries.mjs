import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { findGeneratedWorkerConfig } from "../../../scripts/web-app/assert-worker-build.mjs";

const FORBIDDEN_RUNTIME_PACKAGES = [
  "next",
  "@vercel/",
  "@supabase/",
  "@upstash/",
  "prisma",
  "@prisma/",
];
const RUNTIME_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const SIDE_EFFECT_IMPORT = /\bimport\s*["']([^"']+)["']/g;

function forbiddenPackage(specifier) {
  return FORBIDDEN_RUNTIME_PACKAGES.find((name) => {
    const root = name.endsWith("/") ? name.slice(0, -1) : name;
    return specifier === root || specifier.startsWith(`${root}/`);
  });
}

export function inspectRuntimeSourceEntries(entries) {
  const violations = [];
  for (const { file, source } of entries) {
    for (const pattern of [RUNTIME_IMPORT, SIDE_EFFECT_IMPORT]) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        if (forbiddenPackage(specifier)) violations.push({ file, reference: specifier });
      }
    }
    if (/\bEventSource\s*\(/.test(source)) violations.push({ file, reference: "EventSource" });
    if (/text\/event-stream/.test(source))
      violations.push({ file, reference: "text/event-stream" });
  }
  return violations;
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesBelow(path) : [path];
    }),
  );
  return files.flat();
}

function importerBlock(lockfile, importer) {
  const start = lockfile.indexOf(`  ${importer}:`);
  if (start < 0) throw new Error(`pnpm lockfile has no ${importer} importer`);
  const next = lockfile.indexOf("\n  projects/", start + 1);
  return lockfile.slice(start, next < 0 ? lockfile.length : next);
}

function directImporterPackages(block) {
  return [...block.matchAll(/^      ('[^']+'|[^'\s][^:]*):\n        specifier:/gm)].map((match) =>
    match[1].replaceAll("'", ""),
  );
}

export function assertManifestLockParity(manifest, lockPackages) {
  const manifestPackages = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }).sort();
  const importedPackages = [...new Set(lockPackages)].sort();
  if (JSON.stringify(manifestPackages) !== JSON.stringify(importedPackages)) {
    throw new Error("runtime manifest and lockfile importer dependencies do not match");
  }
}

export function assertRuntimeArtifactMetadata(config, mtimes, expectedEnvironment) {
  const target = config.targetEnvironment;
  if (
    (target !== "staging" && target !== "production") ||
    config.vars?.APP_ENV !== target ||
    (expectedEnvironment && target !== expectedEnvironment)
  ) {
    throw new Error("generated runtime target environment metadata does not match");
  }
  if (mtimes.config < mtimes.source || mtimes.worker < mtimes.source) {
    throw new Error("generated runtime artifact is stale; rebuild before verification");
  }
}

export async function inspectRuntimeBoundaries(root) {
  const appRoot = resolve(root);
  const repositoryRoot = resolve(appRoot, "../..");
  const sourceEntries = [];
  const sourceFiles = [];
  for (const runtimeRoot of [resolve(appRoot, "src"), resolve(appRoot, "worker")]) {
    for (const file of await filesBelow(runtimeRoot)) {
      if (!/[.](?:[cm]?js|tsx?)$/.test(file) || file.endsWith(".d.ts") || /[.]test[.]/.test(file))
        continue;
      sourceFiles.push(file);
      sourceEntries.push({
        file: relative(repositoryRoot, file),
        source: await readFile(file, "utf8"),
      });
    }
  }

  const violations = inspectRuntimeSourceEntries(sourceEntries);
  const packagePath = resolve(appRoot, "package.json");
  const lockfilePath = resolve(repositoryRoot, "pnpm-lock.yaml");
  const sourceConfigPath = resolve(appRoot, "wrangler.jsonc");
  const [manifest, lockfile] = await Promise.all([
    readFile(packagePath, "utf8").then(JSON.parse),
    readFile(lockfilePath, "utf8"),
  ]);
  const lockPackages = directImporterPackages(importerBlock(lockfile, "projects/markets-web-app"));
  assertManifestLockParity(manifest, lockPackages);
  for (const packageName of lockPackages) {
    if (forbiddenPackage(packageName)) {
      violations.push({ file: "pnpm-lock.yaml#projects/markets-web-app", reference: packageName });
    }
  }
  for (const packageName of Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })) {
    if (forbiddenPackage(packageName)) {
      violations.push({ file: "projects/markets-web-app/package.json", reference: packageName });
    }
  }

  let generatedConfigPath;
  try {
    generatedConfigPath = await findGeneratedWorkerConfig(appRoot);
  } catch (error) {
    throw new Error(`invalid generated Worker config: ${error.message}`);
  }
  const generatedConfig = JSON.parse(await readFile(generatedConfigPath, "utf8"));
  const buildRoot = dirname(generatedConfigPath);
  const workerPath = resolve(buildRoot, "index.js");
  const sourceStats = await Promise.all(
    [...sourceFiles, packagePath, lockfilePath, sourceConfigPath].map((file) => stat(file)),
  );
  const [configStats, workerStats] = await Promise.all([
    stat(generatedConfigPath),
    stat(workerPath),
  ]);
  assertRuntimeArtifactMetadata(
    generatedConfig,
    {
      config: configStats.mtimeMs,
      source: Math.max(...sourceStats.map((item) => item.mtimeMs)),
      worker: workerStats.mtimeMs,
    },
    process.env.CLOUDFLARE_ENV,
  );
  let buildFiles;
  try {
    buildFiles = await filesBelow(buildRoot);
  } catch {
    throw new Error("missing dist/server; build Markets before runtime verification");
  }
  const buildEntries = [];
  for (const file of buildFiles) {
    if (![".js", ".mjs", ".cjs"].includes(extname(file))) continue;
    buildEntries.push({
      file: relative(repositoryRoot, file),
      source: await readFile(file, "utf8"),
    });
  }
  violations.push(...inspectRuntimeSourceEntries(buildEntries));
  return violations;
}

async function main() {
  const appRoot = resolve(new URL("..", import.meta.url).pathname);
  const violations = await inspectRuntimeBoundaries(appRoot);
  if (violations.length > 0) {
    process.stderr.write(`${JSON.stringify({ violations }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Markets runtime boundaries: PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
