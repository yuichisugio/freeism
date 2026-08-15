import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateStaticSite } from "../../scripts/sites/smoke-static-site.mjs";

const SITE_CONTRACTS = [
  {
    packageDirectory: "projects/main-web-app",
    wranglerVersion: "4.108.0",
    wrangler: {
      $schema: "./node_modules/wrangler/config-schema.json",
      name: "main-web-app",
      compatibility_date: "2026-07-15",
      workers_dev: false,
      preview_urls: false,
      assets: {
        directory: "./dist",
        not_found_handling: "404-page",
        html_handling: "auto-trailing-slash",
      },
      env: {
        staging: {
          name: "main-web-app-staging",
          workers_dev: false,
          preview_urls: false,
          routes: [{ pattern: "staging.freeism.app", custom_domain: true }],
        },
        production: {
          name: "main-web-app-production",
          workers_dev: false,
          preview_urls: false,
          routes: [{ pattern: "freeism.app", custom_domain: true }],
        },
      },
    },
    scripts: {
      "deploy:staging": "wrangler deploy --env staging",
      "deploy:production": "wrangler deploy --env production",
      "smoke:staging":
        "node ../../scripts/sites/smoke-static-site.mjs --url https://staging.freeism.app/ --canonical https://freeism.app/ --text Freeism --link https://docs.freeism.app/ --link https://points.freeism.app/ --link https://markets.freeism.app/",
      "smoke:production":
        "node ../../scripts/sites/smoke-static-site.mjs --url https://freeism.app/ --canonical https://freeism.app/ --text Freeism --link https://docs.freeism.app/ --link https://points.freeism.app/ --link https://markets.freeism.app/",
    },
  },
  {
    packageDirectory: "projects/docs-web-app",
    wranglerVersion: "4.111.0",
    wrangler: {
      $schema: "./node_modules/wrangler/config-schema.json",
      name: "docs-web-app",
      compatibility_date: "2026-07-15",
      workers_dev: false,
      preview_urls: false,
      assets: {
        directory: "./dist",
        not_found_handling: "404-page",
        html_handling: "auto-trailing-slash",
      },
      env: {
        staging: {
          name: "docs-web-app-staging",
          workers_dev: false,
          preview_urls: false,
          routes: [{ pattern: "staging.docs.freeism.app", custom_domain: true }],
        },
        production: {
          name: "docs-web-app-production",
          workers_dev: false,
          preview_urls: false,
          routes: [{ pattern: "docs.freeism.app", custom_domain: true }],
        },
      },
    },
    scripts: {
      "deploy:staging": "wrangler deploy --env staging",
      "deploy:production": "wrangler deploy --env production",
      "smoke:staging":
        'node ../../scripts/sites/smoke-static-site.mjs --url https://staging.docs.freeism.app/ --canonical https://docs.freeism.app/ --text "無料主義 v3" --link https://staging.docs.freeism.app/en/ --link https://staging.docs.freeism.app/notes',
      "smoke:production":
        'node ../../scripts/sites/smoke-static-site.mjs --url https://docs.freeism.app/ --canonical https://docs.freeism.app/ --text "無料主義 v3" --link https://docs.freeism.app/en/ --link https://docs.freeism.app/notes',
    },
  },
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8"));
}

test("portal and docs use the exact static Worker and domain matrix", async () => {
  for (const contract of SITE_CONTRACTS) {
    assert.deepEqual(
      await readJson(`${contract.packageDirectory}/wrangler.jsonc`),
      contract.wrangler,
    );
  }
});

test("portal and docs expose the exact deploy and smoke scripts with pinned Wrangler", async () => {
  for (const contract of SITE_CONTRACTS) {
    const manifest = await readJson(`${contract.packageDirectory}/package.json`);
    assert.equal(manifest.devDependencies.wrangler, contract.wranglerVersion);
    for (const [name, command] of Object.entries(contract.scripts)) {
      assert.equal(manifest.scripts[name], command);
    }
  }
});

test("validates representative portal and docs HTML", async () => {
  const cases = [
    {
      baseUrl: "https://staging.freeism.app/",
      canonicalUrl: "https://freeism.app/",
      requiredText: ["Freeism"],
      requiredLinks: ["https://docs.freeism.app/", "https://points.freeism.app/"],
      html: `<!doctype html><html><head><link href="https://freeism.app/" rel="canonical"></head><body><h1>Freeism</h1><a href="https://docs.freeism.app/">Docs</a><a href="https://points.freeism.app/">Points</a></body></html>`,
    },
    {
      baseUrl: "https://staging.docs.freeism.app/",
      canonicalUrl: "https://docs.freeism.app/",
      requiredText: ["無料主義 v3"],
      requiredLinks: [
        "https://staging.docs.freeism.app/en/",
        "https://staging.docs.freeism.app/notes",
      ],
      html: `<!doctype html><html><head><link rel='canonical' href='https://docs.freeism.app/'></head><body><h1>無料主義 v3</h1><a href="/en/">English</a><a href="/notes">Notes</a></body></html>`,
    },
  ];

  for (const site of cases) {
    await validateStaticSite({
      ...site,
      fetchImpl: async () => new Response(site.html, { status: 200 }),
    });
  }
});

test("rejects a non-2xx response", async () => {
  await assert.rejects(
    validateStaticSite({
      baseUrl: "https://example.test/",
      canonicalUrl: "https://example.test/",
      requiredText: [],
      requiredLinks: [],
      fetchImpl: async () => new Response("internal details", { status: 503 }),
    }),
    /HTTP status 503/,
  );
});

test("does not expose request credentials when fetch fails", async () => {
  await assert.rejects(
    validateStaticSite({
      baseUrl: "https://user:secret@example.test/",
      canonicalUrl: "https://example.test/",
      requiredText: [],
      requiredLinks: [],
      fetchImpl: async () => {
        throw new Error("request to https://user:secret@example.test/ failed");
      },
    }),
    (error) => {
      assert.equal(error.message, "request failed");
      return true;
    },
  );
});

test("rejects the wrong canonical URL", async () => {
  await assert.rejects(
    validateStaticSite({
      baseUrl: "https://example.test/",
      canonicalUrl: "https://example.test/",
      requiredText: [],
      requiredLinks: [],
      fetchImpl: async () =>
        new Response('<link rel="canonical" href="https://wrong.example/">', { status: 200 }),
    }),
    /canonical URL mismatch/,
  );
});

test("rejects missing required text", async () => {
  await assert.rejects(
    validateStaticSite({
      baseUrl: "https://example.test/",
      canonicalUrl: "https://example.test/",
      requiredText: ["required copy"],
      requiredLinks: [],
      fetchImpl: async () =>
        new Response('<link rel="canonical" href="/">other copy', { status: 200 }),
    }),
    /missing required text/,
  );
});

test("rejects a missing required link", async () => {
  await assert.rejects(
    validateStaticSite({
      baseUrl: "https://example.test/",
      canonicalUrl: "https://example.test/",
      requiredText: [],
      requiredLinks: ["https://example.test/required/"],
      fetchImpl: async () =>
        new Response('<link rel="canonical" href="/"><a href="/other/">Other</a>', {
          status: 200,
        }),
    }),
    /missing required link/,
  );
});

test("resolves actual anchor hrefs against the requested environment URL", async () => {
  await validateStaticSite({
    baseUrl: "https://staging.example.test/",
    canonicalUrl: "https://example.test/",
    requiredText: [],
    requiredLinks: ["https://staging.example.test/notes"],
    fetchImpl: async () =>
      new Response(
        '<link rel="canonical" href="https://example.test/"><a href="/notes">Notes</a>',
        { status: 200 },
      ),
  });
});

test("does not treat text or script fragments as anchor links", async () => {
  await assert.rejects(
    validateStaticSite({
      baseUrl: "https://example.test/",
      canonicalUrl: "https://example.test/",
      requiredText: [],
      requiredLinks: ["https://example.test/required/"],
      fetchImpl: async () =>
        new Response(
          '<link rel="canonical" href="/"><script>const link = "https://example.test/required/";</script>',
          { status: 200 },
        ),
    }),
    /missing required link/,
  );
});

for (const [location, fragment] of [
  [
    "raw text",
    '<script>const template = \'<a href="/required/">Required</a>\';</script>',
  ],
  ["a style element", '<style><a href="/required/">Required</a></style>'],
  ["an HTML comment", '<!-- <a href="/required/">Required</a> -->'],
]) {
  test(`does not treat a complete anchor fragment in ${location} as a link`, async () => {
    await assert.rejects(
      validateStaticSite({
        baseUrl: "https://example.test/",
        canonicalUrl: "https://example.test/",
        requiredText: [],
        requiredLinks: ["https://example.test/required/"],
        fetchImpl: async () =>
          new Response(`<link rel="canonical" href="/">${fragment}`, { status: 200 }),
      }),
      /missing required link/,
    );
  });
}
