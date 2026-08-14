import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

describe("Markets Worker entrypoint contract", () => {
  it("exposes fetch and scheduled handlers from src/server.ts", async () => {
    const server = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");

    expect(server).toContain("fetch(");
    expect(server).toContain("scheduled(");
  });

  it("uses src/server.ts as the only production and test entrypoint", async () => {
    const [wrangler, workerTestConfig] = await Promise.all([
      readFile(resolve(process.cwd(), "wrangler.jsonc"), "utf8"),
      readFile(resolve(process.cwd(), "vitest.worker.config.ts"), "utf8"),
    ]);

    expect(wrangler).toContain('"main": "./src/server.ts"');
    expect(workerTestConfig).toContain('main: "./src/server.ts"');
    await expect(access(resolve(process.cwd(), "worker/index.ts"))).rejects.toThrow();
  });
});
