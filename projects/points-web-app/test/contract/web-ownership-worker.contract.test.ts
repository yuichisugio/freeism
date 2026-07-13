import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vite-plus/test";

describe("Web ownership Worker release contract", () => {
  it("keeps the public-only fetch flag, split Cron schedules, and scheduled exports", async () => {
    const [wrangler, server, worker] = await Promise.all([
      readFile(resolve(process.cwd(), "wrangler.jsonc"), "utf8"),
      readFile(resolve(process.cwd(), "src/server.ts"), "utf8"),
      readFile(resolve(process.cwd(), "worker/index.ts"), "utf8"),
    ]);
    expect(wrangler).toContain('"global_fetch_strictly_public"');
    expect(wrangler).toContain('"crons": ["*/5 * * * *", "*/15 * * * *"]');
    expect(server).toContain("scheduled(");
    expect(worker).toContain("scheduled(");
  });
});
