import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FORBIDDEN_RUNTIME_PACKAGES = [
  "next",
  "@vercel/",
  "@supabase/",
  "@upstash/",
  "prisma",
  "@prisma/",
];
const RUNTIME_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

function forbiddenPackage(specifier) {
  return FORBIDDEN_RUNTIME_PACKAGES.find((name) => {
    const root = name.endsWith("/") ? name.slice(0, -1) : name;
    return specifier === root || specifier.startsWith(`${root}/`);
  });
}

export function inspectRuntimeSourceEntries(entries) {
  const violations = [];
  for (const { file, source } of entries) {
    for (const match of source.matchAll(RUNTIME_IMPORT)) {
      const specifier = match[1];
      if (forbiddenPackage(specifier)) violations.push({ file, reference: specifier });
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

export async function inspectRuntimeBoundaries(root) {
  const appRoot = resolve(root);
  const repositoryRoot = resolve(appRoot, "../..");
  const sourceEntries = [];
  for (const runtimeRoot of [resolve(appRoot, "src"), resolve(appRoot, "worker")]) {
    for (const file of await filesBelow(runtimeRoot)) {
      if (!/[.](?:[cm]?js|tsx?)$/.test(file) || file.endsWith(".d.ts") || /[.]test[.]/.test(file))
        continue;
      sourceEntries.push({
        file: relative(repositoryRoot, file),
        source: await readFile(file, "utf8"),
      });
    }
  }

  const violations = inspectRuntimeSourceEntries(sourceEntries);
  const lockfile = await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8");
  for (const packageName of directImporterPackages(
    importerBlock(lockfile, "projects/markets-web-app"),
  )) {
    if (forbiddenPackage(packageName)) {
      violations.push({ file: "pnpm-lock.yaml#projects/markets-web-app", reference: packageName });
    }
  }

  const buildRoot = resolve(appRoot, "dist/server");
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
