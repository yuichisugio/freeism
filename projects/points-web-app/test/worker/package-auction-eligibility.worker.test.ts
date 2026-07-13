import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { importEvaluationCriteria } from "../../src/backend/usecases/import-evaluation-criteria";
import { importPointPackages } from "../../src/backend/usecases/import-point-packages";
import {
  checkPointPackageAuctionEligibility,
  PointPackageAuctionEligibilityError,
} from "../../src/backend/usecases/check-point-package-auction-eligibility";

const db = env.DB!;

async function seedPackage(pointPackageId: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  await importEvaluationCriteria(db, {
    actorPointsUserId: "pusr_admin",
    reason: "seed",
    items: [
      {
        evaluationCriterionId: `crit_${pointPackageId}`,
        expectedRevision: null,
        status: "ACTIVE",
        name: `Criterion ${pointPackageId}`,
        description: "Description",
        minimumUnit: "0.0001",
        transferEnabled: true,
        exchangeEnabled: true,
        balanceVisibleByDefault: true,
        buyNowEnabled: true,
        relatedUrls: [],
      },
    ],
  });
  const [revision] = await importPointPackages(db, {
    actorPointsUserId: "pusr_admin",
    reason: "seed",
    items: [
      {
        pointPackageId,
        expectedRevision: null,
        status,
        name: `Package ${pointPackageId}`,
        description: null,
        relatedUrl: null,
        components: [
          { evaluationCriterionId: `crit_${pointPackageId}`, displayOrder: 0, weight: 1 },
        ],
      },
    ],
  });
  return revision;
}

function eligibilityInput(
  revision: { pointPackageId: string; pointPackageRevisionId: string; contentHash: string },
  overrides: Record<string, unknown> = {},
) {
  return {
    marketsClientId: "markets-client",
    auctionCommandId: "acmd_1",
    auctionCommandHash: "sha256:command",
    idempotencyKey: "idem-1",
    now: new Date("2026-07-11T00:00:00.000Z"),
    items: [
      {
        auctionItemId: "row_1",
        pointPackageId: revision.pointPackageId,
        pointPackageRevisionId: revision.pointPackageRevisionId,
        contentHash: revision.contentHash,
      },
    ],
    ...overrides,
  };
}

async function resetEvaluationTables() {
  for (const trigger of [
    "evaluation_criterion_revision_no_delete",
    "evaluation_criterion_related_url_no_delete",
    "point_package_normalized_name_history_no_delete",
    "point_package_revision_no_delete",
    "point_package_component_no_delete",
    "point_package_lifecycle_event_no_delete",
  ]) {
    await db.prepare(`DROP TRIGGER IF EXISTS ${trigger}`).run();
  }
  await db.exec(
    "DELETE FROM point_package_auction_eligibility_item; DELETE FROM point_package_auction_eligibility_receipt; DELETE FROM point_package_auction_eligibility_idempotency; DELETE FROM point_package_lifecycle_event; DELETE FROM point_package_component; DELETE FROM point_package_revision; DELETE FROM point_package_normalized_name_history; DELETE FROM point_package; DELETE FROM evaluation_criterion_related_url; DELETE FROM evaluation_criterion_revision; DELETE FROM evaluation_criterion;",
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

describe("Point Package Auction eligibility receipts", () => {
  beforeEach(async () => {
    await resetEvaluationTables();
  });

  it("updates currentRevisionId, lifecycleStatus and eligibilityVersion with an append-only lifecycle event", async () => {
    const first = await seedPackage("pkg_projection");
    let projection = await db
      .prepare(
        "SELECT current_revision_id AS currentRevisionId, lifecycle_status AS lifecycleStatus, eligibility_version AS eligibilityVersion FROM point_package WHERE id = ?",
      )
      .bind(first.pointPackageId)
      .first();
    expect(projection).toEqual({
      currentRevisionId: first.pointPackageRevisionId,
      lifecycleStatus: "ACTIVE",
      eligibilityVersion: 1,
    });

    const [second] = await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "inactive",
      items: [
        {
          pointPackageId: first.pointPackageId,
          expectedRevision: 1,
          status: "INACTIVE",
          name: "Package pkg_projection",
          description: null,
          relatedUrl: null,
          components: [
            { evaluationCriterionId: "crit_pkg_projection", displayOrder: 0, weight: 1 },
          ],
        },
      ],
    });
    projection = await db
      .prepare(
        "SELECT current_revision_id AS currentRevisionId, lifecycle_status AS lifecycleStatus, eligibility_version AS eligibilityVersion FROM point_package WHERE id = ?",
      )
      .bind(first.pointPackageId)
      .first();
    expect(projection).toEqual({
      currentRevisionId: second.pointPackageRevisionId,
      lifecycleStatus: "INACTIVE",
      eligibilityVersion: 2,
    });
    const events = await db
      .prepare(
        "SELECT status FROM point_package_lifecycle_event WHERE point_package_id = ? ORDER BY eligibility_version",
      )
      .bind(first.pointPackageId)
      .all();
    expect(events.results).toEqual([{ status: "ACTIVE" }, { status: "INACTIVE" }]);
    await expect(
      db
        .prepare("DELETE FROM point_package_lifecycle_event WHERE point_package_id = ?")
        .bind(first.pointPackageId)
        .run(),
    ).rejects.toThrow();
  });

  it("accepts 1-1000 unique items and binds the receipt to client, command, hash and normalized items", async () => {
    const revision = await seedPackage("pkg_batch");
    const items = Array.from({ length: 1000 }, (_, index) => ({
      auctionItemId: `row_${String(index).padStart(4, "0")}`,
      pointPackageId: revision.pointPackageId,
      pointPackageRevisionId: revision.pointPackageRevisionId,
      contentHash: revision.contentHash,
    })).reverse();
    const result = await checkPointPackageAuctionEligibility(
      db,
      eligibilityInput(revision, { items }),
    );
    expect(result.status).toBe(201);
    expect(result.body.data.items).toHaveLength(1000);
    expect(result.body.data.items[0]!.auctionItemId).toBe("row_0000");
    expect(result.body.data).toMatchObject({
      auctionCommandId: "acmd_1",
      auctionCommandHash: "sha256:command",
    });
  });

  it("rejects invalid size and duplicate auctionItemId", async () => {
    const revision = await seedPackage("pkg_shape");
    await expect(
      checkPointPackageAuctionEligibility(db, eligibilityInput(revision, { items: [] })),
    ).rejects.toThrow("INVALID_AUCTION_ELIGIBILITY_REQUEST");
    await expect(
      checkPointPackageAuctionEligibility(
        db,
        eligibilityInput(revision, {
          items: [eligibilityInput(revision).items[0], eligibilityInput(revision).items[0]],
        }),
      ),
    ).rejects.toThrow("INVALID_AUCTION_ELIGIBILITY_REQUEST");
  });

  it("checks ownership, saved hash, historical status and current lifecycle atomically with zero receipts on any failure", async () => {
    const active = await seedPackage("pkg_active");
    const inactive = await seedPackage("pkg_inactive", "INACTIVE");
    for (const invalidItem of [
      { ...eligibilityInput(active).items[0], pointPackageId: "pkg_wrong" },
      { ...eligibilityInput(active).items[0], contentHash: "sha256:wrong" },
      eligibilityInput(inactive).items[0],
    ]) {
      await expect(
        checkPointPackageAuctionEligibility(
          db,
          eligibilityInput(active, { idempotencyKey: crypto.randomUUID(), items: [invalidItem] }),
        ),
      ).rejects.toBeInstanceOf(PointPackageAuctionEligibilityError);
    }
    const count = await db
      .prepare("SELECT COUNT(*) AS count FROM point_package_auction_eligibility_receipt")
      .first<{ count: number }>();
    expect(count?.count).toBe(0);
  });

  it("allows an old ACTIVE revision while the package remains ACTIVE and rejects old INACTIVE revisions", async () => {
    const oldActive = await seedPackage("pkg_history");
    await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "new active revision",
      items: [
        {
          pointPackageId: oldActive.pointPackageId,
          expectedRevision: 1,
          status: "ACTIVE",
          name: "Package pkg_history",
          description: "changed",
          relatedUrl: null,
          components: [{ evaluationCriterionId: "crit_pkg_history", displayOrder: 0, weight: 1 }],
        },
      ],
    });
    await expect(
      checkPointPackageAuctionEligibility(db, eligibilityInput(oldActive)),
    ).resolves.toMatchObject({ status: 201 });

    const oldInactive = await seedPackage("pkg_old_inactive", "INACTIVE");
    await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "reactivate",
      items: [
        {
          pointPackageId: oldInactive.pointPackageId,
          expectedRevision: 1,
          status: "ACTIVE",
          name: "Package pkg_old_inactive",
          description: null,
          relatedUrl: null,
          components: [
            { evaluationCriterionId: "crit_pkg_old_inactive", displayOrder: 0, weight: 1 },
          ],
        },
      ],
    });
    await expect(
      checkPointPackageAuctionEligibility(
        db,
        eligibilityInput(oldInactive, { idempotencyKey: "idem-old-inactive" }),
      ),
    ).rejects.toThrow("POINT_PACKAGE_AUCTION_INELIGIBLE");
  });

  it("keeps a successful receipt valid after INACTIVE until the strict 30-second boundary", async () => {
    const revision = await seedPackage("pkg_lease");
    const first = await checkPointPackageAuctionEligibility(db, eligibilityInput(revision));
    expect(first.body.data.checkedAt).toBe("2026-07-11T00:00:00.000Z");
    expect(first.body.data.validUntil).toBe("2026-07-11T00:00:30.000Z");
    expect(first.body.data.serverNowIsEligible("2026-07-11T00:00:29.999Z")).toBe(true);
    expect(first.body.data.serverNowIsEligible("2026-07-11T00:00:30.000Z")).toBe(false);
    expect(first.body.data.serverNowIsEligible("2026-07-11T00:00:30.001Z")).toBe(false);
  });

  it("replays success or failure without extending checkedAt/validUntil and conflicts on a changed payload", async () => {
    const revision = await seedPackage("pkg_idempotent");
    const first = await checkPointPackageAuctionEligibility(db, eligibilityInput(revision));
    const replay = await checkPointPackageAuctionEligibility(
      db,
      eligibilityInput(revision, { now: new Date("2026-07-11T00:00:20.000Z") }),
    );
    expect(replay.body.data.checkedAt).toBe(first.body.data.checkedAt);
    expect(replay.body.data.validUntil).toBe(first.body.data.validUntil);

    await expect(
      checkPointPackageAuctionEligibility(
        db,
        eligibilityInput(revision, { auctionCommandHash: "sha256:changed" }),
      ),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");

    await importPointPackages(db, {
      actorPointsUserId: "pusr_admin",
      reason: "inactive",
      items: [
        {
          pointPackageId: revision.pointPackageId,
          expectedRevision: 1,
          status: "INACTIVE",
          name: "Package pkg_idempotent",
          description: null,
          relatedUrl: null,
          components: [
            { evaluationCriterionId: "crit_pkg_idempotent", displayOrder: 0, weight: 1 },
          ],
        },
      ],
    });
    await expect(
      checkPointPackageAuctionEligibility(
        db,
        eligibilityInput(revision, {
          idempotencyKey: "idem-after-expiry",
          now: new Date("2026-07-11T00:00:31.000Z"),
        }),
      ),
    ).rejects.toThrow("POINT_PACKAGE_AUCTION_INELIGIBLE");
  });
});
