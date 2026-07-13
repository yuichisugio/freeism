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
] as const;
const RUNTIME_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

export type RuntimeBoundaryViolation = {
  file: string;
  packageName: string;
};

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesBelow(path) : [path];
    }),
  );
  return files.flat();
}

function forbiddenPackage(specifier: string): string | undefined {
  return FORBIDDEN_RUNTIME_PACKAGES.find(
    (name) => specifier === name || (name.endsWith("/") && specifier.startsWith(name)),
  );
}

function importedPackages(source: string): string[] {
  return [...source.matchAll(RUNTIME_IMPORT)].map((match) => match[1]!).filter(Boolean);
}

function pointsImporter(lockfile: string): string {
  const start = lockfile.indexOf("  projects/points-web-app:");
  if (start < 0) throw new Error("pnpm lockfile has no Points importer");
  const next = lockfile.indexOf("\n  projects/", start + 1);
  return lockfile.slice(start, next < 0 ? lockfile.length : next);
}

export async function inspectRuntimeDependencies(
  appRoot: string,
): Promise<RuntimeBoundaryViolation[]> {
  const root = resolve(appRoot);
  const repositoryRoot = resolve(root, "../..");
  const runtimeRoots = [resolve(root, "src"), resolve(root, "worker")];
  const violations: RuntimeBoundaryViolation[] = [];

  for (const runtimeRoot of runtimeRoots) {
    for (const file of await filesBelow(runtimeRoot)) {
      if (![".ts", ".tsx", ".js", ".mjs"].includes(extname(file)) || file.endsWith(".d.ts")) {
        continue;
      }
      const source = await readFile(file, "utf8");
      for (const specifier of importedPackages(source)) {
        const packageName = forbiddenPackage(specifier);
        if (packageName) {
          violations.push({ file: relative(repositoryRoot, file), packageName: specifier });
        }
      }
    }
  }

  const importer = pointsImporter(
    await readFile(resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8"),
  );
  for (const packageName of FORBIDDEN_RUNTIME_PACKAGES) {
    const lockfileName = packageName.endsWith("/") ? packageName.slice(0, -1) : packageName;
    if (importer.includes(`${lockfileName}:`)) {
      violations.push({
        file: "pnpm-lock.yaml#projects/points-web-app",
        packageName: lockfileName,
      });
    }
  }

  const buildRoot = resolve(root, "dist/server");
  let buildFiles: string[];
  try {
    buildFiles = await filesBelow(buildRoot);
  } catch {
    throw new Error("missing dist/server; build Points before runtime verification");
  }
  for (const file of buildFiles) {
    if (![".js", ".mjs"].includes(extname(file))) continue;
    const source = await readFile(file, "utf8");
    for (const specifier of importedPackages(source)) {
      const packageName = forbiddenPackage(specifier);
      if (packageName) {
        violations.push({ file: relative(repositoryRoot, file), packageName: specifier });
      }
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const appRoot = resolve(new URL("..", import.meta.url).pathname);
  const violations = await inspectRuntimeDependencies(appRoot);
  if (violations.length > 0) {
    process.stderr.write(`${JSON.stringify({ violations }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Points runtime dependency boundaries: PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
