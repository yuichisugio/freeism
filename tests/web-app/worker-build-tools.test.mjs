import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findGeneratedWorkerConfig } from "../../scripts/web-app/assert-worker-build.mjs";
import { generateStaticSecurityHeaders } from "../../scripts/web-app/generate-static-security-headers.mjs";

async function withFixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "freeism-worker-build-"));
  try {
    const assets = path.join(root, "dist", "client");
    await mkdir(assets, { recursive: true });
    await writeFile(
      path.join(root, "dist", "wrangler.json"),
      JSON.stringify({
        name: "points-worker-staging",
        vars: { APP_ENV: "staging", APP_HOST: "staging.points.freeism.app" },
        assets: { directory: "./client", not_found_handling: "none" },
      }),
    );
    await run({ assets, root });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

test("finds the single generated Wrangler config", async () => {
  await withFixture(async ({ root }) => {
    const configPath = await findGeneratedWorkerConfig(root);
    assert.equal(configPath, path.join(root, "dist", "wrangler.json"));
  });
});

test("rejects a missing fixed HTML artifact", async () => {
  await withFixture(async ({ root }) => {
    await assert.rejects(
      generateStaticSecurityHeaders(root, "staging"),
      /missing HTML artifact: index\.html/,
    );
  });
});

test("writes security headers for clean static page URLs", async () => {
  await withFixture(async ({ assets, root }) => {
    for (const name of ["index", "terms", "privacy", "help", "docs"]) {
      await writeFile(
        path.join(assets, `${name}.html`),
        `<html><script>document.documentElement.dataset.ready="true"</script></html>`,
      );
    }

    await generateStaticSecurityHeaders(root, "staging");
    const headers = await readFile(path.join(assets, "_headers"), "utf8");
    assert.match(headers, /^\/$/m);
    assert.match(headers, /^\/terms$/m);
    assert.match(headers, /script-src 'self' 'sha256-/);
    assert.doesNotMatch(headers, /script-src[^;]*'unsafe-inline'/);
    assert.match(headers, /form-action 'self'/);
    assert.match(headers, /frame-src 'none'/);
    assert.match(headers, /manifest-src 'self'/);
    assert.match(headers, /worker-src 'none'/);
    assert.match(headers, /X-Frame-Options: DENY/);
    assert.match(headers, /\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  });
});
