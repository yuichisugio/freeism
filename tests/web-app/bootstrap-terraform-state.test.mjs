import assert from "node:assert/strict";
import test from "node:test";

import { runBootstrap } from "../../scripts/web-app/bootstrap-terraform-state.mjs";

const envelope = (status, result) =>
  new Response(JSON.stringify({ success: status < 400, result, errors: [] }), {
    status,
    headers: { "content-type": "application/json" },
  });

test("check reports a missing state bucket without creating it", async () => {
  const requests = [];
  const result = await runBootstrap({
    mode: "check",
    env: { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_API_TOKEN: "token" },
    fetchImpl: async (url, init) => {
      requests.push([String(url), init.method]);
      if (String(url).endsWith("/freeism-terraform-state")) return envelope(404, null);
      return envelope(200, { buckets: [] });
    },
    log: () => {},
  });

  assert.equal(result, "absent");
  assert.deepEqual(requests.map(([, method]) => method), ["GET", "GET"]);
});

test("apply creates only an absent state bucket and verifies get plus list", async () => {
  let exists = false;
  const methods = [];
  const result = await runBootstrap({
    mode: "apply",
    env: { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_API_TOKEN: "token" },
    fetchImpl: async (url, init) => {
      methods.push(init.method);
      if (init.method === "POST") {
        exists = true;
        return envelope(200, { name: "freeism-terraform-state" });
      }
      if (String(url).endsWith("/freeism-terraform-state")) {
        return exists
          ? envelope(200, { name: "freeism-terraform-state" })
          : envelope(404, null);
      }
      return envelope(200, {
        buckets: exists ? [{ name: "freeism-terraform-state" }] : [],
      });
    },
    log: () => {},
  });

  assert.equal(result, "created");
  assert.equal(methods.filter((method) => method === "POST").length, 1);
  assert.deepEqual(methods.slice(-2), ["GET", "GET"]);
});
