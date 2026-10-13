import { describe, expect, it } from "vitest";

import { assertPreviewConfig, previewOrigin } from "../../scripts/preview-generated";

const stagingDatabase = "c3859cf6-2786-4191-bffe-cd04331c228e";
const generatedConfig = {
  name: "points-worker-staging",
  targetEnvironment: "staging",
  preview_urls: true,
  workers_dev: false,
  compatibility_flags: [
    "nodejs_compat",
    "assets_navigation_has_no_effect",
    "global_fetch_strictly_public",
  ],
  vars: {
    APP_ENV: "staging",
    APP_HOST: "staging.points.freeism.app",
    APP_ORIGIN: "https://staging.points.freeism.app",
    OAUTH_PROXY_PRODUCTION_URL: "https://staging.points.freeism.app",
    PREVIEW_WORKERS_SUBDOMAIN: "kyogoku",
  },
  assets: {
    directory: "../client",
    not_found_handling: "none",
    html_handling: "auto-trailing-slash",
  },
  d1_databases: [{ binding: "DB", database_id: stagingDatabase }],
};

describe("Points PR Preview deployment contract", () => {
  it("uses a stable aliased Version URL for a PR", () => {
    const origin = previewOrigin(123, "kyogoku");
    expect(origin).toBe("https://points-pr-123-points-worker-staging.kyogoku.workers.dev");
  });

  it("requires the generated staging Worker and its D1 binding", () => {
    expect(() => assertPreviewConfig(generatedConfig, "kyogoku")).not.toThrow();
    expect(() =>
      assertPreviewConfig(
        {
          ...generatedConfig,
          d1_databases: [{ binding: "DB", database_id: "production-db" }],
        },
        "kyogoku",
      ),
    ).toThrow(/staging D1/);
    expect(() => assertPreviewConfig(generatedConfig, "other-subdomain")).toThrow(/subdomain/);
  });
});
