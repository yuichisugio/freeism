import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../../../", import.meta.url);

const legacyWorkflows = [
  ".github/workflows/web-app/ci.yml",
  ".github/workflows/web-app/vercel-preview-deploy.yml",
  ".github/workflows/web-app/vercel-production-deploy.yml",
] as const;

describe("legacy web-app workflow boundary", () => {
  it.each(legacyWorkflows)(
    "%s only reacts to legacy app or workflow changes",
    async (workflowPath) => {
      const workflow = await readFile(
        new URL(workflowPath, repositoryRoot),
        "utf8",
      );

      expect(workflow).toContain('- "projects/web-app/**"');
      expect(workflow).toContain('- ".github/workflows/web-app/**"');
      expect(workflow).not.toMatch(
        /^\s+- "(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)"$/mu,
      );
    },
  );
});
