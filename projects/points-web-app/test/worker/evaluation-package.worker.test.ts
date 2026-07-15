import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  canonicalPointPackageRevisionBytes,
  createPointPackageRevision,
  normalizePointPackageName,
} from "../../src/backend/domain/evaluation/point-package";
import {
  importEvaluationCriteria,
  type EvaluationCriterionImportItem,
} from "../../src/backend/usecases/import-evaluation-criteria";
import {
  importPointPackages,
  type PointPackageImportItem,
} from "../../src/backend/usecases/import-point-packages";
import { readPublicPointPackageRevision } from "../../src/backend/usecases/read-public-point-package-revision";
import { updateProfileEvaluationVisibility } from "../../src/backend/usecases/update-profile-evaluation-visibility";
import { updateProfilePointPackages } from "../../src/backend/usecases/update-profile-point-packages";

const db =
  env.DB ??
  (() => {
    throw new Error("Test D1 binding DB is required");
  })();

function criterion(
  id: string,
  overrides: Partial<EvaluationCriterionImportItem> = {},
): EvaluationCriterionImportItem {
  return {
    evaluationCriterionId: id,
    expectedRevision: null,
    status: "ACTIVE",
    name: `Criterion ${id}`,
    description: "Description",
    minimumUnit: "0.0001",
    transferEnabled: true,
    exchangeEnabled: true,
    balanceVisibleByDefault: true,
    buyNowEnabled: true,
    relatedUrls: [],
    ...overrides,
  };
}

function pointPackage(
  id: string,
  criterionIds: string[],
  overrides: Partial<PointPackageImportItem> = {},
): PointPackageImportItem {
  return {
    pointPackageId: id,
    expectedRevision: null,
    status: "ACTIVE",
    name: `Package ${id}`,
    description: null,
    relatedUrl: null,
    components: criterionIds.map((evaluationCriterionId, displayOrder) => ({
      evaluationCriterionId,
      displayOrder,
      weight: displayOrder + 1,
    })),
    ...overrides,
  };
}

async function seedCriteria(ids: string[]) {
  return importEvaluationCriteria(db, {
    actorPointsUserId: "pusr_admin",
    reason: "test seed",
    items: ids.map((id) => criterion(id)),
    now: new Date("2026-07-11T00:00:00.000Z"),
  });
}

async function resetEvaluationTables() {
  for (const trigger of [
    "evaluation_criterion_revision_no_delete",
    "evaluation_criterion_related_url_no_delete",
    "evaluation_criterion_revision_seal_no_delete",
    "point_package_normalized_name_history_no_delete",
    "point_package_revision_no_delete",
    "point_package_component_no_delete",
    "point_package_revision_seal_no_delete",
    "point_package_lifecycle_event_no_delete",
  ]) {
    await db.prepare(`DROP TRIGGER IF EXISTS ${trigger}`).run();
  }
  await db.exec(
    "DELETE FROM profile_evaluation_visibility; DELETE FROM profile_point_package; DELETE FROM point_package_auction_eligibility_item; DELETE FROM point_package_auction_eligibility_receipt; DELETE FROM point_package_auction_eligibility_idempotency; DELETE FROM point_package_lifecycle_event; DELETE FROM point_package_revision_seal; DELETE FROM point_package_component; DELETE FROM point_package_revision; DELETE FROM point_package_normalized_name_history; DELETE FROM point_package; DELETE FROM evaluation_criterion_revision_seal; DELETE FROM evaluation_criterion_related_url; DELETE FROM evaluation_criterion_revision; DELETE FROM evaluation_criterion; DELETE FROM profiles; DELETE FROM admin_membership; DELETE FROM points_user; DELETE FROM account; DELETE FROM session; DELETE FROM user;",
  );
  for (const [name, table, message] of [
    [
      "evaluation_criterion_revision_no_delete",
      "evaluation_criterion_revision",
      "IMMUTABLE_EVALUATION_CRITERION_REVISION",
    ],
    [
      "evaluation_criterion_related_url_no_delete",
      "evaluation_criterion_related_url",
      "IMMUTABLE_EVALUATION_CRITERION_RELATED_URL",
    ],
    [
      "evaluation_criterion_revision_seal_no_delete",
      "evaluation_criterion_revision_seal",
      "IMMUTABLE_EVALUATION_CRITERION_REVISION_SEAL",
    ],
    [
      "point_package_normalized_name_history_no_delete",
      "point_package_normalized_name_history",
      "IMMUTABLE_POINT_PACKAGE_NORMALIZED_NAME_HISTORY",
    ],
    [
      "point_package_revision_no_delete",
      "point_package_revision",
      "IMMUTABLE_POINT_PACKAGE_REVISION",
    ],
    [
      "point_package_component_no_delete",
      "point_package_component",
      "IMMUTABLE_POINT_PACKAGE_COMPONENT",
    ],
    [
      "point_package_revision_seal_no_delete",
      "point_package_revision_seal",
      "IMMUTABLE_POINT_PACKAGE_REVISION_SEAL",
    ],
    [
      "point_package_lifecycle_event_no_delete",
      "point_package_lifecycle_event",
      "IMMUTABLE_POINT_PACKAGE_LIFECYCLE_EVENT",
    ],
  ]) {
    await db
      .prepare(
        `CREATE TRIGGER ${name} BEFORE DELETE ON ${table}
         BEGIN SELECT RAISE(ABORT, '${message}'); END`,
      )
      .run();
  }
}

describe("evaluation criteria and immutable Point Package revisions", () => {
  beforeEach(async () => {
    await resetEvaluationTables();
  });

  it("accepts 1-20 criteria and validates names, descriptions, URLs and minimumUnit", async () => {
    const twenty = Array.from({ length: 20 }, (_, index) =>
      criterion(`crit_${index}`, {
        name: `${"n".repeat(28)}${String(index).padStart(2, "0")}`,
        description: "d".repeat(200),
        relatedUrls: Array.from(
          { length: 20 },
          (__, urlIndex) => `https://example.test/${index}/${urlIndex}`,
        ),
      }),
    );
    await expect(
      importEvaluationCriteria(db, {
        actorPointsUserId: "pusr_admin",
        reason: "boundary",
        items: twenty,
      }),
    ).resolves.toHaveLength(20);

    for (const invalid of [
      criterion("too-many", {
        relatedUrls: Array.from({ length: 21 }, (_, i) => `https://x.test/${i}`),
      }),
      criterion("empty-name", { name: "" }),
      criterion("long-name", { name: "n".repeat(31) }),
      criterion("empty-description", { description: "" }),
      criterion("long-description", { description: "d".repeat(201) }),
      criterion("zero-unit", { minimumUnit: "0" }),
      criterion("negative-unit", { minimumUnit: "-0.0001" }),
      criterion("five-decimals", { minimumUnit: "0.00001" }),
    ]) {
      await expect(
        importEvaluationCriteria(db, {
          actorPointsUserId: "pusr_admin",
          reason: "invalid",
          items: [invalid],
        }),
      ).rejects.toThrow("INVALID_EVALUATION_CRITERION");
    }
  });

  it("rejects duplicate names, appends ACTIVE to ARCHIVED revisions, and keeps old rows immutable", async () => {
    const relatedUrlTriggers = await db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'trigger' AND name IN (
           'evaluation_criterion_related_url_no_update',
           'evaluation_criterion_related_url_no_delete'
         )
         ORDER BY name`,
      )
      .all<{ name: string }>();
    expect(relatedUrlTriggers.results).toEqual([
      { name: "evaluation_criterion_related_url_no_delete" },
      { name: "evaluation_criterion_related_url_no_update" },
    ]);

    await importEvaluationCriteria(db, {
      actorPointsUserId: "pusr_admin",
      reason: "create",
      items: [
        criterion("crit_a", {
          name: "Same",
          relatedUrls: ["https://example.test/criterion"],
        }),
      ],
    });
    await expect(
      importEvaluationCriteria(db, {
        actorPointsUserId: "pusr_admin",
        reason: "duplicate",
        items: [criterion("crit_b", { name: "Same" })],
      }),
    ).rejects.toThrow("EVALUATION_CRITERION_NAME_CONFLICT");

    const [archived] = await importEvaluationCriteria(db, {
      actorPointsUserId: "pusr_admin",
      reason: "archive",
      items: [criterion("crit_a", { expectedRevision: 1, status: "ARCHIVED", name: "Same" })],
    });
    expect(archived.revision).toBe(2);
    const revisions = await db
      .prepare(
        "SELECT revision, status FROM evaluation_criterion_revision WHERE evaluation_criterion_id = 'crit_a' ORDER BY revision",
      )
      .all<{ revision: number; status: string }>();
    expect(revisions.results).toEqual([
      { revision: 1, status: "ACTIVE" },
      { revision: 2, status: "ARCHIVED" },
    ]);
    await expect(
      db
        .prepare("UPDATE evaluation_criterion_revision SET name = 'changed' WHERE revision = 1")
        .run(),
    ).rejects.toThrow();
    await expect(
      db.prepare("DELETE FROM evaluation_criterion WHERE id = 'crit_a'").run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare("UPDATE evaluation_criterion_related_url SET url = ? WHERE id = ?")
        .bind("https://example.test/changed", "ecr_crit_a_1_url_0")
        .run(),
    ).rejects.toThrow("IMMUTABLE_EVALUATION_CRITERION_RELATED_URL");
    await expect(
      db
        .prepare("DELETE FROM evaluation_criterion_related_url WHERE id = ?")
        .bind("ecr_crit_a_1_url_0")
        .run(),
    ).rejects.toThrow("IMMUTABLE_EVALUATION_CRITERION_RELATED_URL");
    await expect(
      db
        .prepare(
          `INSERT INTO evaluation_criterion_related_url
             (id, evaluation_criterion_revision_id, display_order, url)
           VALUES (?, ?, ?, ?)`,
        )
        .bind("late_related_url", "ecr_crit_a_1", 1, "https://example.test/late-related-url")
        .run(),
    ).rejects.toThrow("IMMUTABLE_EVALUATION_CRITERION_RELATED_URL");
  });

  it("normalizes package names and validates package display fields at code-point and byte boundaries", async () => {
    expect(normalizePointPackageName("  ＰＡＣＫＡＧＥ\u3000Name  ")).toBe("package name");
    expect(normalizePointPackageName("Straße")).toBe("straße");

    await seedCriteria(["crit_a"]);
    await expect(
      importPointPackages(db, {
        actorPointsUserId: "pusr_admin",
        reason: "boundaries",
        items: [
          pointPackage("pkg_min", ["crit_a"], { name: "x", description: "" }),
          pointPackage("pkg_max", ["crit_a"], {
            name: "😀".repeat(60),
            description: "😀".repeat(500),
            relatedUrl: `https://example.test/${"a".repeat(2027)}`,
          }),
        ],
      }),
    ).resolves.toHaveLength(2);

    const nullable = await readPublicPointPackageRevision(db, "ppr_pkg_min_1");
    expect(nullable).toMatchObject({ description: null, relatedUrl: null });

    for (const invalid of [
      pointPackage("pkg_empty", ["crit_a"], { name: "" }),
      pointPackage("pkg_61", ["crit_a"], { name: "x".repeat(61) }),
      pointPackage("pkg_241_bytes", ["crit_a"], { name: `${"界".repeat(80)}a` }),
      pointPackage("pkg_desc_501", ["crit_a"], { description: "d".repeat(501) }),
      pointPackage("pkg_desc_bytes", ["crit_a"], { description: `${"界".repeat(666)}abc` }),
      pointPackage("pkg_http", ["crit_a"], { relatedUrl: "http://example.test" }),
      pointPackage("pkg_userinfo", ["crit_a"], { relatedUrl: "https://user@example.test" }),
      pointPackage("pkg_fragment", ["crit_a"], { relatedUrl: "https://example.test/#x" }),
    ]) {
      await expect(
        importPointPackages(db, {
          actorPointsUserId: "pusr_admin",
          reason: "invalid",
          items: [invalid],
        }),
      ).rejects.toThrow("INVALID_POINT_PACKAGE");
    }
  });

  it("rejects normalized duplicate names independent of status", async () => {
    await seedCriteria(["crit_a"]);
    await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "create",
      items: [pointPackage("pkg_a", ["crit_a"], { name: "Ａ  B" })],
    });
    await expect(
      importPointPackages(db, {
        actorPointsUserId: "pusr_admin",
        reason: "duplicate",
        items: [pointPackage("pkg_b", ["crit_a"], { name: "a\u3000b", status: "INACTIVE" })],
      }),
    ).rejects.toThrow("POINT_PACKAGE_NAME_CONFLICT");

    await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "rename",
      items: [
        pointPackage("pkg_a", ["crit_a"], {
          expectedRevision: 1,
          name: "Renamed",
        }),
      ],
    });
    await expect(
      importPointPackages(db, {
        actorPointsUserId: "pusr_admin",
        reason: "reuse historical name",
        items: [pointPackage("pkg_c", ["crit_a"], { name: "Ａ  B" })],
      }),
    ).rejects.toThrow("POINT_PACKAGE_NAME_CONFLICT");
  });

  it("normalizes positive integer weights by GCD without approximating the ratio and computes packageTick with BigInt", async () => {
    const revision = await createPointPackageRevision({
      pointPackageId: "pkg_ratio",
      pointPackageRevisionId: "ppr_ratio",
      status: "ACTIVE",
      name: "Ratio",
      description: null,
      relatedUrl: null,
      components: [
        {
          evaluationCriterionId: "crit_a",
          evaluationCriterionRevisionId: "ecr_a",
          evaluationCriterionName: "A",
          minimumUnitScaled: 2,
          buyNowEnabled: true,
          displayOrder: 0,
          weight: 2,
        },
        {
          evaluationCriterionId: "crit_b",
          evaluationCriterionRevisionId: "ecr_b",
          evaluationCriterionName: "B",
          minimumUnitScaled: 3,
          buyNowEnabled: false,
          displayOrder: 1,
          weight: 4,
        },
      ],
    });
    expect(revision.components.map(({ weight }) => weight)).toEqual([1, 2]);
    expect(revision.totalWeight).toBe(3);
    expect(revision.packageTick).toBe(18);
    expect(revision.components[0]!.weight / revision.totalWeight).toBe(1 / 3);
  });

  it("rejects duplicate criteria, non-positive or unsafe weights, and non-contiguous display orders", async () => {
    const base = {
      pointPackageId: "pkg_invalid",
      pointPackageRevisionId: "ppr_invalid",
      status: "ACTIVE" as const,
      name: "Invalid",
      description: null,
      relatedUrl: null,
    };
    const component = {
      evaluationCriterionId: "crit_a",
      evaluationCriterionRevisionId: "ecr_a",
      evaluationCriterionName: "A",
      minimumUnitScaled: 1,
      buyNowEnabled: true,
      displayOrder: 0,
      weight: 1,
    };
    for (const components of [
      [component, { ...component, displayOrder: 1 }],
      [{ ...component, weight: 0 }],
      [{ ...component, weight: Number.MAX_SAFE_INTEGER + 1 }],
      [component, { ...component, evaluationCriterionId: "crit_b", displayOrder: 2 }],
    ]) {
      await expect(createPointPackageRevision({ ...base, components })).rejects.toThrow(
        "INVALID_POINT_PACKAGE",
      );
    }
  });

  it("hashes only canonical public fields and creates a new immutable revision for economic or order changes", async () => {
    await seedCriteria(["crit_a", "crit_b"]);
    const [first] = await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "create",
      now: new Date("2026-07-11T00:00:00.000Z"),
      items: [pointPackage("pkg_hash", ["crit_a", "crit_b"], { name: "Hash package" })],
    });
    const publicFirst = await readPublicPointPackageRevision(db, first.pointPackageRevisionId);
    expect(publicFirst.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(new TextDecoder().decode(publicFirst.canonicalBytes)).toBe(
      new TextDecoder().decode(canonicalPointPackageRevisionBytes(publicFirst)),
    );
    expect(publicFirst).not.toHaveProperty("createdAt");
    expect(publicFirst).not.toHaveProperty("actorPointsUserId");
    expect(publicFirst).not.toHaveProperty("auditEventId");

    const [second] = await importPointPackages(db, {
      actorPointsUserId: "pusr_other_admin",
      reason: "reorder",
      now: new Date("2026-07-12T00:00:00.000Z"),
      items: [
        pointPackage("pkg_hash", ["crit_b", "crit_a"], {
          expectedRevision: 1,
          name: "Hash package",
        }),
      ],
    });
    const publicSecond = await readPublicPointPackageRevision(db, second.pointPackageRevisionId);
    expect(publicSecond.contentHash).not.toBe(publicFirst.contentHash);
    expect(
      (await readPublicPointPackageRevision(db, first.pointPackageRevisionId)).contentHash,
    ).toBe(publicFirst.contentHash);
  });

  it("serves a verified public revision with a strong ETag and immutable cache", async () => {
    await seedCriteria(["crit_public"]);
    const [created] = await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "public endpoint",
      items: [pointPackage("pkg_public", ["crit_public"])],
    });
    const url = `http://localhost:3000/api/v1/point-package-revisions/${created.pointPackageRevisionId}`;

    const response = await SELF.fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("etag")).toBe(`"${created.contentHash}"`);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        contentHash: created.contentHash,
        pointPackageId: "pkg_public",
        pointPackageRevisionId: created.pointPackageRevisionId,
      },
      meta: { requestId: expect.stringMatching(/^req_/) },
    });

    const notModified = await SELF.fetch(url, {
      headers: { "If-None-Match": `"${created.contentHash}"` },
    });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(notModified.headers.get("etag")).toBe(`"${created.contentHash}"`);
    expect(await notModified.text()).toBe("");

    const notFound = await SELF.fetch(
      "http://localhost:3000/api/v1/point-package-revisions/missing",
    );
    expect(notFound.status).toBe(404);
    expect(notFound.headers.get("cache-control")).toBe("private, no-store");

    await db.batch([
      db
        .prepare(
          `INSERT INTO point_package_revision
             (id, point_package_id, revision, status, name, description, related_url,
              total_weight, package_tick, content_hash, actor_points_user_id, reason, created_at)
           SELECT 'ppr_pkg_public_corrupt', point_package_id, 2, status, name, description,
                  related_url, total_weight, package_tick, ?, actor_points_user_id, reason, created_at
           FROM point_package_revision WHERE id = ?`,
        )
        .bind(`sha256:${"0".repeat(64)}`, created.pointPackageRevisionId),
      db
        .prepare(
          `INSERT INTO point_package_component
           (id, point_package_revision_id, evaluation_criterion_id,
            evaluation_criterion_revision_id, evaluation_criterion_name,
            display_order, minimum_unit_scaled, buy_now_enabled, weight)
         SELECT 'ppr_pkg_public_corrupt_component_0', 'ppr_pkg_public_corrupt',
                evaluation_criterion_id, evaluation_criterion_revision_id,
                evaluation_criterion_name, display_order, minimum_unit_scaled,
                buy_now_enabled, weight
         FROM point_package_component WHERE point_package_revision_id = ?`,
        )
        .bind(created.pointPackageRevisionId),
    ]);
    const corrupt = await SELF.fetch(
      "http://localhost:3000/api/v1/point-package-revisions/ppr_pkg_public_corrupt",
    );
    expect(corrupt.status).toBe(500);
    expect(corrupt.headers.get("cache-control")).toBe("private, no-store");
  });

  it("updates ordered profile packages idempotently and rejects duplicates", async () => {
    await seedCriteria(["crit_a"]);
    await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "seed",
      items: [pointPackage("pkg_a", ["crit_a"]), pointPackage("pkg_b", ["crit_a"])],
    });
    expect(
      await updateProfilePointPackages(db, { pointsUserId: "pusr_profile", pointPackageIds: [] }),
    ).toEqual([]);
    expect(
      await updateProfilePointPackages(db, {
        pointsUserId: "pusr_profile",
        pointPackageIds: ["pkg_b", "pkg_a"],
      }),
    ).toEqual(["pkg_b", "pkg_a"]);
    expect(
      await updateProfilePointPackages(db, {
        pointsUserId: "pusr_profile",
        pointPackageIds: ["pkg_b", "pkg_a"],
      }),
    ).toEqual(["pkg_b", "pkg_a"]);
    expect(
      await updateProfilePointPackages(db, {
        pointsUserId: "pusr_profile",
        pointPackageIds: ["pkg_a"],
      }),
    ).toEqual(["pkg_a"]);
    await expect(
      updateProfilePointPackages(db, {
        pointsUserId: "pusr_profile",
        pointPackageIds: ["pkg_a", "pkg_a"],
      }),
    ).rejects.toThrow("DUPLICATE_POINT_PACKAGE");
  });

  it("stores five independent criterion visibility flags with documented defaults", async () => {
    await seedCriteria(["crit_a"]);
    const defaults = await updateProfileEvaluationVisibility(db, {
      pointsUserId: "pusr_profile",
      evaluationCriterionId: "crit_a",
      visibility: {},
      balanceVisibleByDefault: true,
      allowPublicExpansion: false,
    });
    expect(defaults).toEqual({
      balance: "PUBLIC",
      evaluationTotal: "PRIVATE",
      fix: "PRIVATE",
      transfer: "PRIVATE",
      exchange: "PRIVATE",
    });
    const changed = await updateProfileEvaluationVisibility(db, {
      pointsUserId: "pusr_profile",
      evaluationCriterionId: "crit_a",
      visibility: {
        balance: "PRIVATE",
        evaluationTotal: "PUBLIC",
        fix: "PUBLIC",
        transfer: "PUBLIC",
        exchange: "PUBLIC",
      },
      balanceVisibleByDefault: true,
      allowPublicExpansion: true,
    });
    expect(changed).toEqual({
      balance: "PRIVATE",
      evaluationTotal: "PUBLIC",
      fix: "PUBLIC",
      transfer: "PUBLIC",
      exchange: "PUBLIC",
    });
  });

  it("rejects a non-fresh PRIVATE to PUBLIC visibility race using the latest D1 state", async () => {
    await seedCriteria(["crit_visibility_race"]);
    await updateProfileEvaluationVisibility(db, {
      pointsUserId: "pusr_profile",
      evaluationCriterionId: "crit_visibility_race",
      visibility: { balance: "PUBLIC" },
      balanceVisibleByDefault: true,
      allowPublicExpansion: true,
    });

    await db
      .prepare(
        `UPDATE profile_evaluation_visibility
         SET balance_visibility = 'PRIVATE'
         WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
      )
      .bind("pusr_profile", "crit_visibility_race")
      .run();

    await expect(
      updateProfileEvaluationVisibility(db, {
        pointsUserId: "pusr_profile",
        evaluationCriterionId: "crit_visibility_race",
        visibility: { balance: "PUBLIC" },
        balanceVisibleByDefault: true,
        allowPublicExpansion: false,
      }),
    ).rejects.toThrow("FRESH_GOOGLE_AUTH_REQUIRED");
    await expect(
      db
        .prepare(
          `SELECT balance_visibility AS balance
           FROM profile_evaluation_visibility
           WHERE points_user_id = ? AND evaluation_criterion_id = ?`,
        )
        .bind("pusr_profile", "crit_visibility_race")
        .first(),
    ).resolves.toEqual({ balance: "PRIVATE" });
  });
});
