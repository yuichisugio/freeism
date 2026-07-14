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

const app = createPointsBackendApp();

async function seedPointsUser(options: {
  accountStatus?: "ACTIVE" | "CLOSED";
  displayName?: string;
  profileVisibility?: "PUBLIC" | "PRIVATE";
  withProfile?: boolean;
}) {
  const suffix = crypto.randomUUID();
  const authUserId = `auth_public_${suffix}`;
  const pointsUserId = `pusr_public_${suffix}`;
  const now = Date.now();
  const displayName = options.displayName ?? `Public ${suffix.slice(0, 8)}`;
  await db.batch([
    db
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .bind(authUserId, displayName, `${authUserId}@example.invalid`, now, now),
    db
      .prepare(
        "INSERT INTO points_user (id, auth_user_id, account_status, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(pointsUserId, authUserId, options.accountStatus ?? "ACTIVE", now),
  ]);
  if (options.withProfile !== false) {
    await db
      .prepare(
        `INSERT INTO profiles
           (points_user_id, display_name, description, external_urls, visibility, created_at, updated_at)
         VALUES (?, ?, 'Public description', '["https://example.test/profile"]', ?, ?, ?)`,
      )
      .bind(pointsUserId, displayName, options.profileVisibility ?? "PUBLIC", now, now)
      .run();
  }
  return { authUserId, displayName, pointsUserId };
}

async function get(path: string) {
  return app.fetch(new Request(`https://points.test${path}`), env);
}

describe("public Points profile and search API", () => {
  it("serves an initial public profile without a profiles row and never exposes email", async () => {
    const user = await seedPointsUser({ displayName: "Initial Public User", withProfile: false });

    const response = await get(`/api/v1/profiles/${user.pointsUserId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    const body = (await response.json()) as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain(`${user.authUserId}@example.invalid`);
    expect(body).toMatchObject({
      data: {
        canonicalUrl: `https://points.freeism.app/profiles/${user.pointsUserId}`,
        description: "",
        displayName: "Initial Public User",
        evaluationAccounts: [],
        externalIdentities: [],
        pointPackages: [],
        pointsUserId: user.pointsUserId,
      },
      meta: { requestId: expect.stringMatching(/^req_/) },
    });
  });

  it("does not disclose whether a private or closed profile exists", async () => {
    const privateUser = await seedPointsUser({ profileVisibility: "PRIVATE" });
    const closedUser = await seedPointsUser({ accountStatus: "CLOSED" });

    for (const pointsUserId of [privateUser.pointsUserId, closedUser.pointsUserId]) {
      const response = await get(`/api/v1/profiles/${pointsUserId}`);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      await expect(response.json()).resolves.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    }
  });

  it("returns only ACTIVE identities whose current ownership epoch still belongs to the user", async () => {
    const user = await seedPointsUser({ displayName: "Identity Public User" });
    const now = Date.now();
    const activeOwnershipId = `own_active_${crypto.randomUUID()}`;
    const activeEpochId = `epoch_active_${crypto.randomUUID()}`;
    const inactiveOwnershipId = `own_inactive_${crypto.randomUUID()}`;
    const inactiveEpochId = `epoch_inactive_${crypto.randomUUID()}`;
    await db.batch([
      db
        .prepare(
          `INSERT INTO identity_ownership
             (id, identity_type, normalized_identity_key, points_user_id, status,
              current_ownership_epoch_id, verified_at, permanent_correspondence)
           VALUES (?, 'WEB_URL', ?, ?, 'ACTIVE', ?, ?, 0)`,
        )
        .bind(
          activeOwnershipId,
          `https://example.test/${user.pointsUserId}`,
          user.pointsUserId,
          activeEpochId,
          now,
        ),
      db
        .prepare(
          `INSERT INTO ownership_epoch
             (id, identity_ownership_id, owner_points_user_id, effective_at, ended_at,
              verification_method, evidence_hash, success_count, request_id, created_at)
           VALUES (?, ?, ?, ?, NULL, 'REL_ME', ?, 1, ?, ?)`,
        )
        .bind(
          activeEpochId,
          activeOwnershipId,
          user.pointsUserId,
          now,
          "a".repeat(64),
          `req_${crypto.randomUUID()}`,
          now,
        ),
      db
        .prepare(
          `INSERT INTO identity_ownership
             (id, identity_type, normalized_identity_key, points_user_id, status,
              current_ownership_epoch_id, verified_at, permanent_correspondence)
           VALUES (?, 'GITHUB_OAUTH', ?, ?, 'INACTIVE', ?, ?, 1)`,
        )
        .bind(
          inactiveOwnershipId,
          `github:${crypto.randomUUID()}`,
          user.pointsUserId,
          inactiveEpochId,
          now,
        ),
      db
        .prepare(
          `INSERT INTO ownership_epoch
             (id, identity_ownership_id, owner_points_user_id, effective_at, ended_at,
              verification_method, evidence_hash, success_count, request_id, created_at)
           VALUES (?, ?, ?, ?, NULL, 'GITHUB_OAUTH', ?, 1, ?, ?)`,
        )
        .bind(
          inactiveEpochId,
          inactiveOwnershipId,
          user.pointsUserId,
          now,
          "b".repeat(64),
          `req_${crypto.randomUUID()}`,
          now,
        ),
    ]);

    const response = await get(`/api/v1/profiles/${user.pointsUserId}`);

    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("https://example.test/profile");
    expect(body).toMatchObject({
      data: {
        externalIdentities: [
          {
            identityType: "WEB_URL",
            profileUrl: `https://example.test/${user.pointsUserId}`,
            verifiedAt: new Date(now).toISOString(),
          },
        ],
      },
    });
  });

  it("searches public active profiles, criteria and packages by name or immutable ID", async () => {
    const marker = crypto.randomUUID().slice(0, 8);
    const publicUser = await seedPointsUser({ displayName: `Needle Person ${marker}` });
    await seedPointsUser({ displayName: `Needle Private ${marker}`, profileVisibility: "PRIVATE" });
    const evaluationCriterionId = `crit_needle_${marker}`;
    const pointPackageId = `pkg_needle_${marker}`;
    await importEvaluationCriteria(db, {
      actorPointsUserId: publicUser.pointsUserId,
      items: [
        {
          balanceVisibleByDefault: true,
          buyNowEnabled: true,
          description: "Public criterion",
          evaluationCriterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Needle Criterion ${marker}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "public search test",
    });
    await importPointPackages(db, {
      actorPointsUserId: publicUser.pointsUserId,
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId, weight: 1 }],
          description: "Public package",
          expectedRevision: null,
          name: `Needle Package ${marker}`,
          pointPackageId,
          relatedUrl: null,
          status: "ACTIVE",
        },
      ],
      reason: "public search test",
    });

    const byName = await get(`/api/v1/search?q=${encodeURIComponent(marker)}`);
    expect(byName.status).toBe(200);
    expect(byName.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    await expect(byName.json()).resolves.toMatchObject({
      data: {
        evaluationCriteria: [{ evaluationCriterionId, name: `Needle Criterion ${marker}` }],
        pointPackages: [{ name: `Needle Package ${marker}`, pointPackageId }],
        profiles: [
          { displayName: `Needle Person ${marker}`, pointsUserId: publicUser.pointsUserId },
        ],
      },
    });

    const byId = await get(`/api/v1/search?q=${encodeURIComponent(pointPackageId)}`);
    await expect(byId.json()).resolves.toMatchObject({
      data: { pointPackages: [{ pointPackageId }] },
    });
  });

  it("publishes only current ACTIVE criterion and Package references", async () => {
    const marker = crypto.randomUUID().slice(0, 8);
    const user = await seedPointsUser({ displayName: `Reference ${marker}` });
    const evaluationCriterionId = `crit_reference_${marker}`;
    const pointPackageId = `pkg_reference_${marker}`;
    await importEvaluationCriteria(db, {
      actorPointsUserId: user.pointsUserId,
      items: [
        {
          balanceVisibleByDefault: true,
          buyNowEnabled: true,
          description: "Criterion description",
          evaluationCriterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Reference Criterion ${marker}`,
          relatedUrls: ["https://example.test/criterion"],
          status: "ACTIVE",
          transferEnabled: true,
        },
      ],
      reason: "public detail test",
    });
    const packageResult = await importPointPackages(db, {
      actorPointsUserId: user.pointsUserId,
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId, weight: 1 }],
          description: "Package description",
          expectedRevision: null,
          name: `Reference Package ${marker}`,
          pointPackageId,
          relatedUrl: "https://example.test/package",
          status: "ACTIVE",
        },
      ],
      reason: "public detail test",
    });
    const revisionId = packageResult[0]!.pointPackageRevisionId;
    await db.batch([
      db
        .prepare(
          `INSERT INTO profile_point_package (id, points_user_id, point_package_id, display_order)
           VALUES (?, ?, ?, 0)`,
        )
        .bind(`ppp_${crypto.randomUUID()}`, user.pointsUserId, pointPackageId),
      db
        .prepare(
          `INSERT INTO point_account
             (points_user_id, evaluation_criterion_id, balance, evaluation_total, updated_at)
           VALUES (?, ?, 12500, -2500, ?)`,
        )
        .bind(user.pointsUserId, evaluationCriterionId, Date.now()),
      db
        .prepare(
          `INSERT INTO profile_evaluation_visibility
             (id, points_user_id, evaluation_criterion_id, balance_visibility,
              evaluation_total_visibility, fix_visibility, transfer_visibility, exchange_visibility)
           VALUES (?, ?, ?, 'PUBLIC', 'PRIVATE', 'PRIVATE', 'PRIVATE', 'PRIVATE')`,
        )
        .bind(`pev_${crypto.randomUUID()}`, user.pointsUserId, evaluationCriterionId),
    ]);

    const criterion = await get(`/api/v1/evaluation-criteria/${evaluationCriterionId}`);
    expect(criterion.status).toBe(200);
    await expect(criterion.json()).resolves.toMatchObject({
      data: {
        description: "Criterion description",
        evaluationCriterionId,
        minimumUnit: "0.0001",
        name: `Reference Criterion ${marker}`,
        relatedUrls: ["https://example.test/criterion"],
      },
    });

    const pointPackage = await get(`/api/v1/point-packages/${pointPackageId}`);
    expect(pointPackage.status).toBe(200);
    const packageBody = (await pointPackage.json()) as {
      data: Record<string, unknown>;
    };
    expect(packageBody.data).toEqual({
      name: `Reference Package ${marker}`,
      pointPackageId,
      pointPackageRevisionId: revisionId,
      pointPackageRevisionUrl: `https://points.freeism.app/api/v1/point-package-revisions/${revisionId}`,
    });
    expect(packageBody.data).not.toHaveProperty("components");

    const profile = await get(`/api/v1/profiles/${user.pointsUserId}`);
    await expect(profile.json()).resolves.toMatchObject({
      data: {
        evaluationAccounts: [
          {
            balance: "1.25",
            evaluationCriterionId,
            name: `Reference Criterion ${marker}`,
          },
        ],
        pointPackages: [
          {
            displayOrder: 0,
            pointPackageId,
            pointPackageRevisionId: revisionId,
            pointPackageRevisionUrl: `https://points.freeism.app/api/v1/point-package-revisions/${revisionId}`,
          },
        ],
      },
    });
    const profileBody = (await (await get(`/api/v1/profiles/${user.pointsUserId}`)).json()) as {
      data: { evaluationAccounts: Array<Record<string, unknown>> };
    };
    expect(profileBody.data.evaluationAccounts[0]).not.toHaveProperty("evaluationTotal");

    const revision = await get(`/api/v1/point-package-revisions/${revisionId}`);
    expect(revision.status).toBe(200);
  });

  it("keeps archived criteria and inactive Packages undisclosed", async () => {
    const marker = crypto.randomUUID().slice(0, 8);
    const user = await seedPointsUser({ displayName: `Inactive ${marker}` });
    const activeCriterionId = `crit_active_${marker}`;
    const archivedCriterionId = `crit_archived_${marker}`;
    const inactivePackageId = `pkg_inactive_${marker}`;
    await importEvaluationCriteria(db, {
      actorPointsUserId: user.pointsUserId,
      items: [
        {
          balanceVisibleByDefault: true,
          buyNowEnabled: true,
          description: "Active component criterion",
          evaluationCriterionId: activeCriterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Active Component ${marker}`,
          relatedUrls: [],
          status: "ACTIVE",
          transferEnabled: true,
        },
        {
          balanceVisibleByDefault: true,
          buyNowEnabled: true,
          description: "Archived public criterion",
          evaluationCriterionId: archivedCriterionId,
          exchangeEnabled: true,
          expectedRevision: null,
          minimumUnit: "0.0001",
          name: `Hidden Criterion ${marker}`,
          relatedUrls: [],
          status: "ARCHIVED",
          transferEnabled: true,
        },
      ],
      reason: "inactive public resource test",
    });
    await importPointPackages(db, {
      actorPointsUserId: user.pointsUserId,
      items: [
        {
          components: [{ displayOrder: 0, evaluationCriterionId: activeCriterionId, weight: 1 }],
          description: null,
          expectedRevision: null,
          name: `Hidden Package ${marker}`,
          pointPackageId: inactivePackageId,
          relatedUrl: null,
          status: "INACTIVE",
        },
      ],
      reason: "inactive public resource test",
    });

    for (const path of [
      `/api/v1/evaluation-criteria/${archivedCriterionId}`,
      `/api/v1/point-packages/${inactivePackageId}`,
    ]) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }

    const search = await get(`/api/v1/search?q=${encodeURIComponent(marker)}`);
    const body = (await search.json()) as {
      data: {
        evaluationCriteria: Array<{ evaluationCriterionId: string }>;
        pointPackages: Array<{ pointPackageId: string }>;
      };
    };
    expect(
      body.data.evaluationCriteria.map(({ evaluationCriterionId }) => evaluationCriterionId),
    ).not.toContain(archivedCriterionId);
    expect(body.data.pointPackages.map(({ pointPackageId }) => pointPackageId)).not.toContain(
      inactivePackageId,
    );
  });
});
