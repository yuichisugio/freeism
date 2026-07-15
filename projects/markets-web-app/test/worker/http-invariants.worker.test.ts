import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();

const origin = "https://markets.example.test";

async function createAuthenticatedApp() {
  const suffix = crypto.randomUUID();
  const authUserId = `auth-http-${suffix}`;
  const marketsUserId = `musr_http_${suffix}`;
  await db.batch([
    db
      .prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
      .bind(authUserId, "HTTP invariant", `${suffix}@example.test`),
    db
      .prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
      .bind(marketsUserId, authUserId),
    db
      .prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
      )
      .bind(`account-${suffix}`, `google-${suffix}`, authUserId),
  ]);

  let confirmCalls = 0;
  const app = createMarketsBackendApp(
    async () => ({
      session: { id: `session-${suffix}`, userId: authUserId },
      user: { id: authUserId },
    }),
    {
      confirm: async (_actor, _sessionId, pendingId) => {
        confirmCalls += 1;
        return { pointsConnectionId: pendingId, status: "ACTIVE" as const };
      },
      completeCallback: async () => ({ pendingId: `mpc-${suffix}` }),
      start: async () => ({ authorizationUrl: `${origin}/test-authorization` }),
    },
  );
  return { app, getConfirmCalls: () => confirmCalls };
}

function confirmRequest(
  pendingId: string,
  options: {
    body?: string;
    headers?: Record<string, string>;
    idempotencyKey?: string | null;
  } = {},
) {
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: origin,
    "Sec-Fetch-Site": "same-origin",
    ...options.headers,
  });
  if (options.idempotencyKey !== null) {
    headers.set("Idempotency-Key", options.idempotencyKey ?? `idem_${crypto.randomUUID()}`);
  }
  return new Request(`${origin}/api/points-connection/confirm`, {
    body: options.body ?? JSON.stringify({ pendingId }),
    headers,
    method: "POST",
  });
}

async function expectProblem(response: Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("Content-Type")).toContain("application/problem+json");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  const body = (await response.json()) as Record<string, unknown>;
  expect(body).toMatchObject({
    code: code ?? expect.stringMatching(/^[A-Z][A-Z0-9_]+$/),
    requestId: expect.stringMatching(/^req_/),
    status,
    title: expect.any(String),
    type: expect.any(String),
  });
}

describe("Markets HTTP mutation invariants", () => {
  it("rejects a cross-origin browser mutation before invoking the use case", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const response = await app.fetch(
      confirmRequest("mpc-cross-origin", { headers: { Origin: "https://evil.example" } }),
      env,
    );

    await expectProblem(response, 403);
    expect(getConfirmCalls()).toBe(0);
  });

  it("rejects cross-site Fetch Metadata even when the Origin value is valid", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const response = await app.fetch(
      confirmRequest("mpc-cross-site", { headers: { "Sec-Fetch-Site": "cross-site" } }),
      env,
    );

    await expectProblem(response, 403);
    expect(getConfirmCalls()).toBe(0);
  });

  it("requires JSON and an Idempotency-Key for a mutation", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const unsupported = await app.fetch(
      confirmRequest("mpc-content-type", { headers: { "Content-Type": "text/plain" } }),
      env,
    );
    await expectProblem(unsupported, 415, "CONTENT_TYPE_UNSUPPORTED");

    const missingKey = await app.fetch(
      confirmRequest("mpc-missing-key", { idempotencyKey: null }),
      env,
    );
    await expectProblem(missingKey, 400, "IDEMPOTENCY_KEY_REQUIRED");
    expect(getConfirmCalls()).toBe(0);
  });

  it("rejects a JSON body over 64 KiB before invoking the use case", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const response = await app.fetch(
      confirmRequest("mpc-too-large", {
        body: JSON.stringify({ padding: "x".repeat(64 * 1024), pendingId: "mpc-too-large" }),
      }),
      env,
    );

    await expectProblem(response, 413, "REQUEST_BODY_TOO_LARGE");
    expect(getConfirmCalls()).toBe(0);
  });

  it("replays the first status and domain result for the same key and canonical payload", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const first = await app.fetch(confirmRequest("mpc-replay", { idempotencyKey }), env);
    const firstBody = (await first.json()) as { data: unknown };
    const replay = await app.fetch(
      confirmRequest("mpc-replay", {
        body: JSON.stringify({ pendingId: "mpc-replay" }),
        idempotencyKey,
      }),
      env,
    );

    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    expect(replay.status).toBe(first.status);
    expect(replay.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(replay.json()).resolves.toMatchObject({ data: firstBody.data });
    expect(getConfirmCalls()).toBe(1);
  });

  it("rejects reuse of an Idempotency-Key with a changed payload", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const first = await app.fetch(confirmRequest("mpc-first", { idempotencyKey }), env);
    expect(first.status).toBe(200);

    const conflict = await app.fetch(confirmRequest("mpc-changed", { idempotencyKey }), env);
    await expectProblem(conflict, 409, "IDEMPOTENCY_KEY_REUSED");
    expect(getConfirmCalls()).toBe(1);
  });

  it("does not require Turnstile for an ordinary same-origin mutation", async () => {
    const { app, getConfirmCalls } = await createAuthenticatedApp();
    const response = await app.fetch(confirmRequest("mpc-no-challenge"), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getConfirmCalls()).toBe(1);
  });
});
