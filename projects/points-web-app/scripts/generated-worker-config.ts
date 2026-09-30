import { access } from "node:fs/promises";
import path from "node:path";

/**
 * Vite / Wrangler が出力する wrangler.json を1つだけ探す。
 */
export async function findGeneratedWorkerConfig(appPath: string): Promise<string> {
  const root = path.resolve(appPath);
  const candidates = [
    path.join(root, "dist", "server", "wrangler.json"),
    path.join(root, "dist", "wrangler.json"),
  ];
  const configs: string[] = [];
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
  return configs[0]!;
}
