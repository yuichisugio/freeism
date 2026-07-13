import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createPointsBackendApp } from "../../src/backend/app";
import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();

async function createAuthenticatedProfileApp() {
  const authUserId = `profile-test-${crypto.randomUUID()}`;
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .bind(authUserId, `Display ${authUserId}`, `${authUserId}@example.invalid`, now, now)
    .run();

  return createPointsBackendApp({
    getSession: async () => ({
      session: { createdAt: new Date(), userId: authUserId },
      user: { id: authUserId },
    }),
  });
}

function profileRequest(body: unknown, idempotencyKey = `idem_${crypto.randomUUID()}`) {
  return new Request("https://points.test/api/profile", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "PUT",
  });
}

function mutationRequest(path: string, body: unknown, idempotencyKey: string) {
  return new Request(`https://points.test${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    method: "PUT",
  });
}

async function seedCriterionAndPackage(suffix: string) {
  const evaluationCriterionId = `crit_profile_${suffix}`;
  const pointPackageId = `pkg_profile_${suffix}`;
  await importEvaluationCriteria(db, {
    actorPointsUserId: "pusr_admin",
    reason: "profile idempotency test",
    items: [
      {
        evaluationCriterionId,
        expectedRevision: null,
        status: "ACTIVE",
        name: `Criterion ${suffix.slice(0, 8)}`,
        description: "Description",
        minimumUnit: "0.0001",
        transferEnabled: true,
        exchangeEnabled: true,
        balanceVisibleByDefault: false,
        buyNowEnabled: true,
        relatedUrls: [],
      },
    ],
  });
  await importPointPackages(db, {
    actorPointsUserId: "pusr_admin",
    reason: "profile idempotency test",
    items: [
      {
        pointPackageId,
        expectedRevision: null,
        status: "ACTIVE",
        name: `Package ${suffix}`,
        description: null,
        relatedUrl: null,
        components: [{ evaluationCriterionId, displayOrder: 0, weight: 1 }],
      },
    ],
  });
  return { evaluationCriterionId, pointPackageId };
}

describe("authenticated profile and idempotency", () => {
  it("returns the PUBLIC initial profile with future collection boundaries", async () => {
    const app = await createAuthenticatedProfileApp();

    const response = await app.fetch(new Request("https://points.test/api/profile"), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        description: "",
        displayName: expect.any(String),
        evaluationVisibilities: [],
        externalUrls: [],
        pointPackages: [],
        pointsUserId: expect.stringMatching(/^pusr_/),
        visibility: "PUBLIC",
      },
      meta: { requestId: expect.stringMatching(/^req_/) },
    });
  });

  it("updates profile fields without changing the Points user ID", async () => {
    const app = await createAuthenticatedProfileApp();
    const initial = (await (
      await app.fetch(new Request("https://points.test/api/profile"), env)
    ).json()) as { data: { pointsUserId: string } };

    const response = await app.fetch(
      profileRequest({
        description: "Profile description",
        displayName: "Updated display name",
        externalUrls: ["https://example.com/profile"],
        visibility: "PRIVATE",
      }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        description: "Profile description",
        displayName: "Updated display name",
        evaluationVisibilities: [],
        externalUrls: ["https://example.com/profile"],
        pointPackages: [],
        pointsUserId: initial.data.pointsUserId,
        visibility: "PRIVATE",
      },
    });
  });

  it("reuses the saved status and body for the same key and canonical payload", async () => {
    const app = await createAuthenticatedProfileApp();
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const first = await app.fetch(
      profileRequest(
        {
          displayName: "Canonical profile",
          description: "same payload",
          visibility: "PUBLIC",
          externalUrls: ["https://example.com/a", "https://example.com/b"],
        },
        idempotencyKey,
      ),
      env,
    );
    const firstBody = await first.json();

    const replay = await app.fetch(
      profileRequest(
        {
          externalUrls: ["https://example.com/a", "https://example.com/b"],
          visibility: "PUBLIC",
          description: "same payload",
          displayName: "Canonical profile",
        },
        idempotencyKey,
      ),
      env,
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(first.status);
    await expect(replay.json()).resolves.toEqual(firstBody);
  });

  it("rejects reuse of the same key with a different canonical payload", async () => {
    const app = await createAuthenticatedProfileApp();
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const first = await app.fetch(
      profileRequest(
        { displayName: "First", description: "", externalUrls: [], visibility: "PUBLIC" },
        idempotencyKey,
      ),
      env,
    );
    expect(first.status).toBe(200);

    const conflict = await app.fetch(
      profileRequest(
        { displayName: "Second", description: "", externalUrls: [], visibility: "PUBLIC" },
        idempotencyKey,
      ),
      env,
    );

    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      status: 409,
    });
  });

  it("returns Problem Details 413 before parsing a body over 64 KiB", async () => {
    const app = await createAuthenticatedProfileApp();

    const response = await app.fetch(
      profileRequest({
        description: "x".repeat(65_536),
        displayName: "large body",
        externalUrls: [],
        visibility: "PUBLIC",
      }),
      env,
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      code: "REQUEST_BODY_TOO_LARGE",
      status: 413,
    });
  });

  it("replays Point Package profile mutations and conflicts on a changed payload", async () => {
    const app = await createAuthenticatedProfileApp();
    await app.fetch(new Request("https://points.test/api/profile"), env);
    const seeded = await seedCriterionAndPackage(crypto.randomUUID());
    const key = `idem_${crypto.randomUUID()}`;
    const first = await app.fetch(
      mutationRequest(
        "/api/profile/point-packages",
        { pointPackageIds: [seeded.pointPackageId] },
        key,
      ),
      env,
    );
    const firstBody = await first.json();
    const replay = await app.fetch(
      mutationRequest(
        "/api/profile/point-packages",
        { pointPackageIds: [seeded.pointPackageId] },
        key,
      ),
      env,
    );
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual(firstBody);

    const conflict = await app.fetch(
      mutationRequest("/api/profile/point-packages", { pointPackageIds: [] }, key),
      env,
    );
    expect(conflict.status).toBe(409);
  });

  it("replays visibility mutations and includes criterionId in the idempotency payload", async () => {
    const app = await createAuthenticatedProfileApp();
    await app.fetch(new Request("https://points.test/api/profile"), env);
    const firstCriterion = await seedCriterionAndPackage(crypto.randomUUID());
    const secondCriterion = await seedCriterionAndPackage(crypto.randomUUID());
    const key = `idem_${crypto.randomUUID()}`;
    const body = {
      balanceVisibility: "PRIVATE",
      evaluationTotalVisibility: "PRIVATE",
      fixHistoryVisibility: "PRIVATE",
      transferHistoryVisibility: "PRIVATE",
      exchangeHistoryVisibility: "PRIVATE",
    };
    const path = `/api/profile/evaluation-visibilities/${firstCriterion.evaluationCriterionId}`;
    const first = await app.fetch(mutationRequest(path, body, key), env);
    const firstBody = await first.json();
    const replay = await app.fetch(mutationRequest(path, body, key), env);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toEqual(firstBody);

    const changedPayload = await app.fetch(
      mutationRequest(path, { ...body, evaluationTotalVisibility: "PUBLIC" }, key),
      env,
    );
    expect(changedPayload.status).toBe(409);

    const conflict = await app.fetch(
      mutationRequest(
        `/api/profile/evaluation-visibilities/${secondCriterion.evaluationCriterionId}`,
        body,
        key,
      ),
      env,
    );
    expect(conflict.status).toBe(409);
  });
});
