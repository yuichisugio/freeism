import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";

import { fetchPointsApi } from "./index";

const authorization = `Basic ${btoa("tester:test-password")}`;

function createEnvironment(overrides: Partial<Env> = {}) {
  const fetchAsset = vi.fn(async (request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/") {
      return new Response("<main>Points shell</main>", {
        headers: { "Content-Type": "text/html" },
      });
    }
    if (pathname === "/assets/app.js") {
      return new Response("console.log('points')", {
        headers: { "Content-Type": "text/javascript" },
      });
    }
    return new Response(null, { status: 404 });
  });
  return {
    bindings: {
      ...env,
      APP_ENV: "staging",
      BASIC_AUTH_USERNAME: "tester",
      BASIC_AUTH_PASSWORD: "test-password",
      ASSETS: { fetch: fetchAsset } as unknown as Fetcher,
      ...overrides,
    } as Env,
    fetchAsset,
  };
}

describe("Points staging Basic authentication", () => {
  it.each(["/", "/dashboard", "/assets/app.js", "/terms"])(
    "challenges unauthenticated requests to %s before serving assets",
    async (path) => {
      const { bindings, fetchAsset } = createEnvironment();
      const response = await fetchPointsApi(new Request(`https://points.test${path}`), bindings);

      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
      expect(fetchAsset).not.toHaveBeenCalled();
    },
  );

  it("rejects incorrect credentials", async () => {
    const { bindings } = createEnvironment();
    const response = await fetchPointsApi(
      new Request("https://points.test/", {
        headers: { Authorization: `Basic ${btoa("tester:wrong-password")}` },
      }),
      bindings,
    );

    expect(response.status).toBe(401);
  });

  it("serves authenticated navigation and static files", async () => {
    const { bindings } = createEnvironment();
    const navigation = await fetchPointsApi(
      new Request("https://points.test/dashboard", {
        headers: { Authorization: authorization, Accept: "text/html" },
      }),
      bindings,
    );
    const script = await fetchPointsApi(
      new Request("https://points.test/assets/app.js", {
        headers: { Authorization: authorization },
      }),
      bindings,
    );

    expect(navigation.status).toBe(200);
    expect(await navigation.text()).toContain("Points shell");
    expect(script.status).toBe(200);
    expect(script.headers.get("Content-Type")).toBe("text/javascript");
    expect(await script.text()).toContain("console.log");
  });

  it("preserves HEAD behavior for authenticated assets", async () => {
    const { bindings } = createEnvironment();
    const response = await fetchPointsApi(
      new Request("https://points.test/assets/app.js", {
        method: "HEAD",
        headers: { Authorization: authorization },
      }),
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/javascript");
    expect(await response.text()).toBe("");
  });

  it.each(["local", "production"] as const)(
    "does not challenge %s even if both secrets are present",
    async (environment) => {
      const { bindings } = createEnvironment({ APP_ENV: environment });
      const response = await fetchPointsApi(
        new Request("https://points.test/dashboard", { headers: { Accept: "text/html" } }),
        bindings,
      );

      expect(response.status).toBe(200);
      expect(response.headers.has("WWW-Authenticate")).toBe(false);
    },
  );

  it.each([
    { BASIC_AUTH_USERNAME: undefined, BASIC_AUTH_PASSWORD: undefined },
    { BASIC_AUTH_USERNAME: undefined },
    { BASIC_AUTH_PASSWORD: undefined },
  ])("does not enable authentication when either secret is absent: %j", async (overrides) => {
    const { bindings } = createEnvironment(overrides);
    const response = await fetchPointsApi(
      new Request("https://points.test/dashboard", { headers: { Accept: "text/html" } }),
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.has("WWW-Authenticate")).toBe(false);
  });

  it.each(["/api/health", "/api/missing", "/.well-known/missing"])(
    "preserves protocol handling for %s",
    async (path) => {
      const { bindings, fetchAsset } = createEnvironment();
      const response = await fetchPointsApi(
        new Request(`https://points.test${path}`, {
          headers: { Authorization: "Bearer api-access-token" },
        }),
        bindings,
      );

      expect(response.status).toBe(path === "/api/health" ? 200 : 404);
      expect(response.headers.has("WWW-Authenticate")).toBe(false);
      expect(fetchAsset).not.toHaveBeenCalled();
    },
  );
});
