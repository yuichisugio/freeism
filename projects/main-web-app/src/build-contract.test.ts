import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = new URL("../", import.meta.url);
const builtRoot = new URL("../dist/index.html", import.meta.url);

describe("portal production build contract", () => {
  it(
    "publishes the production canonical URL",
    async () => {
      await execFileAsync("pnpm", ["exec", "astro", "build"], {
        cwd: projectRoot,
      });

      expect(await readFile(builtRoot, "utf8")).toContain(
        '<link rel="canonical" href="https://freeism.app/">',
      );
    },
    30_000,
  );
});
