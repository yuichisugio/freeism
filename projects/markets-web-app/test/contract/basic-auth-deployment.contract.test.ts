import { describe, expect, it } from "vite-plus/test";

import { assertGeneratedConfig } from "../../scripts/deploy-generated.mjs";
import { loadReleaseTarget } from "../../scripts/migrate-d1.mjs";

async function deploymentFixture(environment: "staging" | "production") {
  const expected = await loadReleaseTarget(environment);
  const config = {
    targetEnvironment: environment,
    name: expected.workerName,
    workers_dev: false,
    preview_urls: false,
    vars: { APP_ENV: environment, APP_HOST: expected.host, APP_ORIGIN: expected.origin },
    assets: {
      directory: "../client",
      not_found_handling: "none",
      html_handling: "auto-trailing-slash",
      run_worker_first: environment === "staging" ? true : ["/api/*", "/.well-known/*"],
    },
    compatibility_flags: [
      "nodejs_compat",
      "assets_navigation_has_no_effect",
      "global_fetch_strictly_public",
    ],
    d1_databases: [
      {
        binding: expected.database.binding,
        database_id: expected.database.id,
        database_name: expected.database.name,
      },
    ],
    durable_objects: { bindings: [expected.durableObject] },
    workflows: [expected.workflow],
    analytics_engine_datasets: [expected.analytics],
    send_email: [expected.email],
    triggers: { crons: ["*/5 * * * *"] },
    routes: [expected.route],
    observability: expected.observability,
  };
  return { config, expected };
}

describe("Markets Basic authentication deployment contract", () => {
  it.each(["staging", "production"] as const)(
    "accepts Worker-first routing for %s",
    async (environment) => {
      const { config, expected } = await deploymentFixture(environment);
      expect(() => assertGeneratedConfig(config, environment, expected)).not.toThrow();
    },
  );

  it("rejects staging assets that can bypass the Worker", async () => {
    const { config, expected } = await deploymentFixture("staging");
    config.assets.run_worker_first = ["/api/*", "/.well-known/*"];
    expect(() => assertGeneratedConfig(config, "staging", expected)).toThrow("Worker-first");
  });

  it("preserves production asset routing", async () => {
    const { config, expected } = await deploymentFixture("production");
    config.assets.run_worker_first = true;
    expect(() => assertGeneratedConfig(config, "production", expected)).toThrow("Worker-first");
  });
});
