import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const repositoryRoot = new URL("../../../", import.meta.url);

const removedDeploymentWorkflows = [
  ".github/workflows/web-app/vercel-preview-deploy.yml",
  ".github/workflows/web-app/vercel-production-deploy.yml",
] as const;

describe("legacy web-app workflow boundary", () => {
  it.each(removedDeploymentWorkflows)("keeps %s removed", async (workflowPath) => {
    await expect(access(new URL(workflowPath, repositoryRoot))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps legacy CI scoped to the legacy app and its tooling", async () => {
    const workflow = await readFile(
      new URL(".github/workflows/web-app/ci.yml", repositoryRoot),
      "utf8",
    );

    expect(workflow).toContain('- "projects/web-app/**"');
    expect(workflow).toContain('- ".github/workflows/web-app/**"');
    expect(workflow).toContain('- ".github/actions/web-app-setup/**"');
    expect(workflow).not.toMatch(
      /^\s+- "(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)"$/mu,
    );
  });
});
