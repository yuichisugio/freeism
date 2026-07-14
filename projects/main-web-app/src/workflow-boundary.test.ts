import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../../../", import.meta.url);

const legacyWorkflows = [
  ".github/workflows/web-app/ci.yml",
  ".github/workflows/web-app/vercel-preview-deploy.yml",
  ".github/workflows/web-app/vercel-production-deploy.yml",
] as const;

const deploymentWorkflows = [
  ".github/workflows/web-app/vercel-preview-deploy.yml",
  ".github/workflows/web-app/vercel-production-deploy.yml",
] as const;

describe("legacy web-app workflow boundary", () => {
  it.each(legacyWorkflows)(
    "%s ignores monorepo-level dependency changes",
    async (workflowPath) => {
      const workflow = await readFile(
        new URL(workflowPath, repositoryRoot),
        "utf8",
      );

      expect(workflow).toContain('- "projects/web-app/**"');
      expect(workflow).not.toMatch(
        /^\s+- "(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)"$/mu,
      );
    },
  );

  it("keeps CI coverage for legacy workflow and setup changes", async () => {
    const workflow = await readFile(
      new URL(".github/workflows/web-app/ci.yml", repositoryRoot),
      "utf8",
    );

    expect(workflow).toContain('- ".github/workflows/web-app/**"');
    expect(workflow).toContain('- ".github/actions/web-app-setup/**"');
  });

  it.each(deploymentWorkflows)(
    "%s deploys only for legacy app changes",
    async (workflowPath) => {
      const workflow = await readFile(
        new URL(workflowPath, repositoryRoot),
        "utf8",
      );

      expect(workflow).not.toContain('- ".github/workflows/web-app/**"');
      expect(workflow).not.toContain('- ".github/actions/web-app-setup/**"');
    },
  );
});
