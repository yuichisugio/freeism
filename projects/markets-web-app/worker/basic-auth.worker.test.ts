import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { fetchMarketsApi } from "../src/server";

const credentials = { BASIC_AUTH_USERNAME: "tester", BASIC_AUTH_PASSWORD: "test-password" };
const authorization = `Basic ${btoa("tester:test-password")}`;

function request(path: string, workerEnv: Env, headers: HeadersInit = {}) {
  return fetchMarketsApi(new Request(`https://markets.test${path}`, { headers }), workerEnv);
}

describe("Markets staging Basic authentication", () => {
  const staging = { ...env, ...credentials, APP_ENV: "staging" } as Env;

  it.each(["/", "/login", "/auctions", "/index.html", "/assets/test.js"])(
    "challenges unauthenticated access to %s",
    async (path) => {
      const response = await request(path, staging);
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
    },
  );

  it("rejects incorrect credentials", async () => {
    const response = await request("/", staging, {
      Authorization: `Basic ${btoa("tester:incorrect")}`,
    });
    expect(response.status).toBe(401);
  });

  it("serves the SPA shell with correct credentials", async () => {
    const response = await request("/auctions", staging, {
      Accept: "text/html",
      Authorization: authorization,
    });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("data-markets-shell");
  });

  it("serves static assets with correct credentials", async () => {
    const response = await request("/assets/test.js", staging, { Authorization: authorization });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/javascript");
    await expect(response.text()).resolves.toContain("markets-test-asset");
  });

  it("serves asset headers without a body for HEAD", async () => {
    const response = await fetchMarketsApi(
      new Request("https://markets.test/assets/test.js", {
        method: "HEAD",
        headers: { Authorization: authorization },
      }),
      staging,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/javascript");
    expect(await response.text()).toBe("");
  });

  it.each(["/api/health", "/api/missing", "/.well-known/missing"])(
    "preserves protocol responses for %s",
    async (path) => {
      const response = await request(path, staging, { Authorization: "Bearer protocol-token" });
      expect(response.status).toBe(path === "/api/health" ? 200 : 404);
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
    },
  );

  it.each(["production", "local"])(
    "does not enable Basic authentication in %s even when secrets exist",
    async (APP_ENV) => {
      const response = await request("/", { ...env, ...credentials, APP_ENV } as Env, {
        Accept: "text/html",
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
    },
  );

  it.each([{}, { BASIC_AUTH_USERNAME: "tester" }, { BASIC_AUTH_PASSWORD: "test-password" }])(
    "only enables authentication when both secrets exist: %j",
    async (secrets) => {
      const response = await request("/", { ...env, ...secrets, APP_ENV: "staging" } as Env, {
        Accept: "text/html",
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("WWW-Authenticate")).toBeNull();
    },
  );
});
