import { env } from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { createMarketsBackendApp } from "../../src/backend/app";

const origin = "https://markets.example.test";

async function seedProof() {
  const suffix = crypto.randomUUID();
  const sellerAuthUserId = `auth_seller_${suffix}`;
  const buyerAuthUserId = `auth_buyer_${suffix}`;
  const sellerMarketsUserId = `musr_seller_${suffix}`;
  const buyerMarketsUserId = `musr_buyer_${suffix}`;
  const auctionId = `auction_${suffix}`;
  const auctionRevisionId = `auction_revision_${suffix}`;
  const packageSnapshotId = `package_snapshot_${suffix}`;
  const pointPackageRevisionId = `package_revision_${suffix}`;
  const settlementId = `settlement_${suffix}`;
  const settlementRoundId = `settlement_round_${suffix}`;
  const allocationId = `allocation_${suffix}`;
  const proofId = `proof_${suffix}`;
  const settledAt = "2026-07-14T02:00:00.000Z";
  const planHash = "a".repeat(64);
  const contentHash = "b".repeat(64);
  const item = {
    description: "Immutable description",
    externalUrl: "https://example.test/item",
    title: "Immutable item",
  };
  const seller = { displayName: "Seller at settlement", marketsUserId: sellerMarketsUserId };
  const buyer = { displayName: "Buyer at settlement", marketsUserId: buyerMarketsUserId };
  const sellerSnapshot = {
    ...seller,
    accountId: `google_seller_${suffix}`,
    accessToken: "seller-secret-token",
    email: "seller-private@example.test",
    providerId: "google",
  };
  const buyerSnapshot = {
    ...buyer,
    accountId: `google_buyer_${suffix}`,
    accessToken: "buyer-secret-token",
    email: "buyer-private@example.test",
    providerId: "google",
  };
  const componentVector = [
    {
      amountScaled: "10000",
      evaluationCriterionId: "criterion_1",
      evaluationCriterionRevisionId: "criterion_revision_1",
    },
  ];

  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Seller now', ?)").bind(
      sellerAuthUserId,
      `${sellerAuthUserId}@example.test`,
    ),
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Buyer now', ?)").bind(
      buyerAuthUserId,
      `${buyerAuthUserId}@example.test`,
    ),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
    ).bind(`account_seller_${suffix}`, `google_seller_${suffix}`, sellerAuthUserId),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
    ).bind(`account_buyer_${suffix}`, `google_buyer_${suffix}`, buyerAuthUserId),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      sellerMarketsUserId,
      sellerAuthUserId,
    ),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      buyerMarketsUserId,
      buyerAuthUserId,
    ),
    env.DB.prepare(
      `INSERT INTO point_package_snapshots
       (id, point_package_id, point_package_revision_id, name, total_weight)
       VALUES (?, ?, ?, 'Proof package', 1)`,
    ).bind(packageSnapshotId, `package_${suffix}`, pointPackageRevisionId),
    env.DB.prepare(
      `INSERT INTO auctions (id, seller_markets_user_id, status, version)
       VALUES (?, ?, 'SETTLED', 1)`,
    ).bind(auctionId, sellerMarketsUserId),
    env.DB.prepare(
      `INSERT INTO auction_revisions
       (id, auction_id, revision_number, title, description, external_url,
        seller_identity_snapshot, points_issuer, point_package_snapshot_id, quantity,
        starts_at, ends_at, package_tick, eligibility_receipt_id, auction_command_id,
        auction_command_hash, package_eligibility_version, eligibility_checked_at,
        eligibility_valid_until, commit_started_at)
       VALUES (?, ?, 1, ?, ?, ?, ?, 'points.freeism.app', ?, 1, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(
      auctionRevisionId,
      auctionId,
      item.title,
      item.description,
      item.externalUrl,
      JSON.stringify(sellerSnapshot),
      packageSnapshotId,
      settledAt,
      settledAt,
      `eligibility_${suffix}`,
      `command_${suffix}`,
      "c".repeat(64),
      settledAt,
      settledAt,
      settledAt,
    ),
    env.DB.prepare("UPDATE auctions SET current_revision_id = ? WHERE id = ?").bind(
      auctionRevisionId,
      auctionId,
    ),
    env.DB.prepare(
      `INSERT INTO settlements
       (id, auction_id, kind, source_key, saga_state, current_plan_id)
       VALUES (?, ?, 'END_OF_AUCTION', ?, 'SETTLED', ?)`,
    ).bind(settlementId, auctionId, `end:${suffix}`, `plan_${suffix}`),
    env.DB.prepare(
      `INSERT INTO settlement_rounds
       (id, settlement_id, round_ordinal, plan_hash, cutoff_hash, state,
        first_attempt_at, retry_deadline_at)
       VALUES (?, ?, 1, ?, ?, 'RESERVED', ?, ?)`,
    ).bind(settlementRoundId, settlementId, planHash, "d".repeat(64), settledAt, settledAt),
    env.DB.prepare(
      `INSERT INTO settlement_allocations
       (id, settlement_id, settlement_round_id, allocation_ordinal, auction_id,
        buyer_markets_user_id, point_reservation_id, quantity,
        uniform_price_tick_count, price_ticks, vector_hash, settled_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, 2, 3, 6, ?, ?)`,
    ).bind(
      allocationId,
      settlementId,
      settlementRoundId,
      auctionId,
      buyerMarketsUserId,
      `reservation_${suffix}`,
      "e".repeat(64),
      settledAt,
    ),
    env.DB.prepare(
      `INSERT INTO proofs
       (id, allocation_id, settlement_id, auction_id, auction_revision_id,
        buyer_markets_user_id, point_package_revision_id, item_snapshot_json,
        seller_identity_snapshot_json, buyer_identity_snapshot_json,
        allocation_quantity, uniform_price_tick_count, price_ticks,
        component_vector_json, completion_status, settled_at, plan_hash, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 3, 6, ?, 'SETTLED', ?, ?, ?)`,
    ).bind(
      proofId,
      allocationId,
      settlementId,
      auctionId,
      auctionRevisionId,
      buyerMarketsUserId,
      pointPackageRevisionId,
      JSON.stringify(item),
      JSON.stringify(sellerSnapshot),
      JSON.stringify(buyerSnapshot),
      JSON.stringify(componentVector),
      settledAt,
      planHash,
      contentHash,
    ),
  ]);

  return {
    auctionId,
    auctionRevisionId,
    buyer,
    buyerAuthUserId,
    buyerMarketsUserId,
    componentVector,
    contentHash,
    item,
    planHash,
    pointPackageRevisionId,
    proofId,
    seller,
    sellerAuthUserId,
    sellerMarketsUserId,
    settledAt,
  };
}

function appFor(authUserId: string | null) {
  return createMarketsBackendApp(async () =>
    authUserId
      ? {
          session: { id: `session_${authUserId}`, userId: authUserId },
          user: { id: authUserId },
        }
      : null,
  );
}

function reviewRequest(
  proofId: string,
  body: Record<string, unknown>,
  idempotencyKey = `idem_${crypto.randomUUID()}`,
) {
  return new Request(`${origin}/api/v1/proofs/${proofId}/review-revisions`, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
    },
    method: "POST",
  });
}

async function postReview(
  authUserId: string,
  proofId: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
) {
  const response = await appFor(authUserId).fetch(
    reviewRequest(proofId, body, idempotencyKey),
    env,
  );
  return {
    body: (await response.json()) as {
      data?: { direction: string; revisionId: string; revisionNumber: number };
    },
    response,
  };
}

async function seedAuthenticatedUser(label: string) {
  const suffix = crypto.randomUUID();
  const authUserId = `auth_${label}_${suffix}`;
  const marketsUserId = `musr_${label}_${suffix}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)").bind(
      authUserId,
      label,
      `${suffix}@example.test`,
    ),
    env.DB.prepare(
      "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
    ).bind(`account_${suffix}`, `google_${suffix}`, authUserId),
    env.DB.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)").bind(
      marketsUserId,
      authUserId,
    ),
  ]);
  return { authUserId, marketsUserId };
}

describe("public proof and mutual reviews", () => {
  it("applies the constrained review revision schema", async () => {
    const rows = await env.DB.prepare(
      `SELECT type, name FROM sqlite_schema
       WHERE name IN (
         'proof_reviews', 'proof_review_revisions',
         'proof_review_revisions_no_update', 'proof_review_revisions_no_delete',
         'proof_reviews_current_pointer_guard'
       ) ORDER BY name`,
    ).all<{ name: string; type: string }>();

    expect(rows.results).toEqual([
      { name: "proof_review_revisions", type: "table" },
      { name: "proof_review_revisions_no_delete", type: "trigger" },
      { name: "proof_review_revisions_no_update", type: "trigger" },
      { name: "proof_reviews", type: "table" },
      { name: "proof_reviews_current_pointer_guard", type: "trigger" },
    ]);
  });

  it("returns the immutable proof snapshot without a login", async () => {
    const seeded = await seedProof();
    const response = await createMarketsBackendApp(async () => null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}`),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("ETag")).toBe(`"${seeded.contentHash}"`);
    expect(await response.json()).toEqual({
      data: {
        allocation: {
          componentVector: seeded.componentVector,
          quantity: 2,
          uniformPriceTickCount: 3,
        },
        auctionId: seeded.auctionId,
        auctionRevisionId: seeded.auctionRevisionId,
        buyer: seeded.buyer,
        canonicalUrl: `${origin}/proofs/${seeded.proofId}`,
        completionStatus: "SETTLED",
        contentHash: seeded.contentHash,
        item: seeded.item,
        planHash: seeded.planHash,
        pointPackageRevisionId: seeded.pointPackageRevisionId,
        proofId: seeded.proofId,
        seller: seeded.seller,
        settledAt: seeded.settledAt,
      },
    });
  });

  it("creates the seller-to-buyer revision and audit atomically", async () => {
    const seeded = await seedProof();
    const response = await appFor(seeded.sellerAuthUserId).fetch(
      reviewRequest(seeded.proofId, {
        comment: "Completed",
        completionProofUrl: null,
        rating: 5,
      }),
      env,
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = (await response.json()) as {
      data: { direction: string; revisionId: string; revisionNumber: number };
    };
    expect(body.data).toMatchObject({
      direction: "SELLER_TO_BUYER",
      revisionId: expect.stringMatching(/^proof-review-revision_/),
      revisionNumber: 1,
    });
    expect(
      await env.DB.prepare(
        `SELECT
           (SELECT count(*) FROM proof_reviews WHERE proof_id = ?) AS reviews,
           (SELECT count(*) FROM proof_review_revisions r
             JOIN proof_reviews v ON v.id = r.review_id WHERE v.proof_id = ?) AS revisions,
           (SELECT count(*) FROM audit_events
             WHERE target_type = 'PROOF_REVIEW' AND target_id = ?) AS audits`,
      )
        .bind(seeded.proofId, seeded.proofId, seeded.proofId)
        .first(),
    ).toMatchObject({ audits: 1, reviews: 1, revisions: 1 });
  });

  it("keeps two current directions and exposes append-only cursor history separately", async () => {
    const seeded = await seedProof();
    const publicBefore = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}`),
      env,
    );
    const immutableBefore = {
      body: await publicBefore.text(),
      cacheControl: publicBefore.headers.get("Cache-Control"),
      etag: publicBefore.headers.get("ETag"),
    };
    const sellerKey = `idem_${crypto.randomUUID()}`;
    const sellerInput = { comment: "First", completionProofUrl: null, rating: 4 };
    const firstSeller = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      sellerInput,
      sellerKey,
    );
    const sellerReplay = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      sellerInput,
      sellerKey,
    );
    const firstBuyer = await postReview(
      seeded.buyerAuthUserId,
      seeded.proofId,
      { comment: "Received", completionProofUrl: null, rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );
    const secondSeller = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { comment: "Updated", completionProofUrl: "https://example.test/done", rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );

    expect(firstSeller.response.status).toBe(201);
    expect(sellerReplay.response.status).toBe(200);
    expect(sellerReplay.body.data?.revisionId).toBe(firstSeller.body.data?.revisionId);
    expect(firstBuyer.body.data).toMatchObject({
      direction: "BUYER_TO_SELLER",
      revisionNumber: 1,
    });
    expect(secondSeller.body.data).toMatchObject({
      direction: "SELLER_TO_BUYER",
      revisionNumber: 2,
    });

    const current = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}/reviews`),
      env,
    );
    expect(current.status).toBe(200);
    expect(current.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    expect(current.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
    expect(await current.json()).toMatchObject({
      data: {
        reviews: [
          {
            comment: "Received",
            currentRevisionId: firstBuyer.body.data?.revisionId,
            direction: "BUYER_TO_SELLER",
            rating: 5,
          },
          {
            comment: "Updated",
            completionProofUrl: "https://example.test/done",
            currentRevisionId: secondSeller.body.data?.revisionId,
            direction: "SELLER_TO_BUYER",
            rating: 5,
          },
        ],
      },
    });

    const firstPage = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}/review-revisions?limit=2`),
      env,
    );
    expect(firstPage.status).toBe(200);
    expect(firstPage.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
    const firstPageBody = (await firstPage.json()) as {
      data: { items: Array<{ revisionId: string }>; nextCursor: string | null };
    };
    expect(firstPageBody.data.items).toHaveLength(2);
    expect(firstPageBody.data.nextCursor).toEqual(expect.any(String));
    const secondPage = await appFor(null).fetch(
      new Request(
        `${origin}/api/v1/proofs/${seeded.proofId}/review-revisions?limit=2&cursor=${encodeURIComponent(firstPageBody.data.nextCursor!)}`,
      ),
      env,
    );
    const secondPageBody = (await secondPage.json()) as {
      data: { items: Array<{ revisionId: string }>; nextCursor: string | null };
    };
    expect(secondPageBody.data.items).toHaveLength(1);
    expect(secondPageBody.data.nextCursor).toBeNull();
    expect(
      new Set([
        ...firstPageBody.data.items.map((item) => item.revisionId),
        ...secondPageBody.data.items.map((item) => item.revisionId),
      ]),
    ).toEqual(
      new Set([
        firstSeller.body.data?.revisionId,
        firstBuyer.body.data?.revisionId,
        secondSeller.body.data?.revisionId,
      ]),
    );

    await env.DB.prepare("UPDATE user SET name = 'Renamed' WHERE id IN (?, ?)")
      .bind(seeded.sellerAuthUserId, seeded.buyerAuthUserId)
      .run();
    const publicAfter = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}`),
      env,
    );
    expect({
      body: await publicAfter.text(),
      cacheControl: publicAfter.headers.get("Cache-Control"),
      etag: publicAfter.headers.get("ETag"),
    }).toEqual(immutableBefore);
  });

  it("normalizes review comments and enforces code point, byte, and control boundaries", async () => {
    const seeded = await seedProof();
    const omitted = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );
    expect(omitted.response.status).toBe(201);

    const normalized = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { comment: "e\u0301\r\n\t", completionProofUrl: "", rating: 4 },
      `idem_${crypto.randomUUID()}`,
    );
    expect(normalized.response.status).toBe(201);
    const normalizedCurrent = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}/reviews`),
      env,
    );
    expect(await normalizedCurrent.json()).toMatchObject({
      data: {
        reviews: [{ comment: "é\n\t", completionProofUrl: null }],
      },
    });

    const max = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { comment: "😀".repeat(2_000), completionProofUrl: null, rating: 3 },
      `idem_${crypto.randomUUID()}`,
    );
    expect(max.response.status).toBe(201);
    const invalidComments = ["😀".repeat(2_001), "bad\u0000", "bad\u0080"];
    for (const comment of invalidComments) {
      const result = await postReview(
        seeded.sellerAuthUserId,
        seeded.proofId,
        { comment, completionProofUrl: null, rating: 3 },
        `idem_${crypto.randomUUID()}`,
      );
      expect(result.response.status).toBe(422);
      expect(result.body).toMatchObject({ code: "PROOF_REVIEW_COMMENT_INVALID" });
    }
  });

  it("canonicalizes one optional HTTPS completion URL and rejects invalid boundaries", async () => {
    const seeded = await seedProof();
    const canonical = await postReview(
      seeded.buyerAuthUserId,
      seeded.proofId,
      {
        comment: "",
        completionProofUrl: "https://BÜCHER.example:443/a/../done",
        rating: 5,
      },
      `idem_${crypto.randomUUID()}`,
    );
    expect(canonical.response.status).toBe(201);
    const current = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}/reviews`),
      env,
    );
    expect(await current.json()).toMatchObject({
      data: {
        reviews: [{ completionProofUrl: "https://xn--bcher-kva.example/done" }],
      },
    });

    const prefix = "https://example.test/";
    const exact = `${prefix}${"a".repeat(2_048 - new TextEncoder().encode(prefix).byteLength)}`;
    expect(new TextEncoder().encode(exact)).toHaveLength(2_048);
    expect(
      (
        await postReview(
          seeded.buyerAuthUserId,
          seeded.proofId,
          { comment: "", completionProofUrl: exact, rating: 5 },
          `idem_${crypto.randomUUID()}`,
        )
      ).response.status,
    ).toBe(201);

    for (const completionProofUrl of [
      `${exact}a`,
      "http://example.test/done",
      "https://user@example.test/done",
      "https://example.test/done#fragment",
      "https://example.test/bad\u0000",
    ]) {
      const result = await postReview(
        seeded.buyerAuthUserId,
        seeded.proofId,
        { comment: "", completionProofUrl, rating: 5 },
        `idem_${crypto.randomUUID()}`,
      );
      expect(result.response.status).toBe(422);
      expect(result.body).toMatchObject({ code: "PROOF_REVIEW_COMPLETION_URL_INVALID" });
    }
  });

  it("enforces rating, participant authorization, idempotency, and mutation request guards", async () => {
    const seeded = await seedProof();
    const stranger = await seedAuthenticatedUser("stranger");
    const baseBody = { comment: "Safe", completionProofUrl: null, rating: 1 };
    expect(
      (
        await appFor(null).fetch(
          reviewRequest(seeded.proofId, baseBody, `idem_${crypto.randomUUID()}`),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await postReview(
          stranger.authUserId,
          seeded.proofId,
          baseBody,
          `idem_${crypto.randomUUID()}`,
        )
      ).response.status,
    ).toBe(403);

    const key = `idem_${crypto.randomUUID()}`;
    const accepted = await postReview(seeded.sellerAuthUserId, seeded.proofId, baseBody, key);
    expect(accepted.response.status).toBe(201);
    const conflict = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { ...baseBody, rating: 2 },
      key,
    );
    expect(conflict.response.status).toBe(409);
    expect(conflict.body).toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });

    for (const rating of [0, 1.5, 6]) {
      const invalid = await postReview(
        seeded.sellerAuthUserId,
        seeded.proofId,
        { ...baseBody, rating },
        `idem_${crypto.randomUUID()}`,
      );
      expect(invalid.response.status).toBe(422);
      expect(invalid.body).toMatchObject({ code: "PROOF_REVIEW_RATING_INVALID" });
    }
    expect(
      (
        await postReview(
          seeded.sellerAuthUserId,
          seeded.proofId,
          { ...baseBody, rating: 5 },
          `idem_${crypto.randomUUID()}`,
        )
      ).response.status,
    ).toBe(201);

    const crossOrigin = reviewRequest(seeded.proofId, baseBody, `idem_${crypto.randomUUID()}`);
    crossOrigin.headers.set("Origin", "https://evil.example");
    expect((await appFor(seeded.sellerAuthUserId).fetch(crossOrigin, env)).status).toBe(403);
    const textBody = reviewRequest(seeded.proofId, baseBody, `idem_${crypto.randomUUID()}`);
    textBody.headers.set("Content-Type", "text/plain");
    expect((await appFor(seeded.sellerAuthUserId).fetch(textBody, env)).status).toBe(415);
    const oversized = reviewRequest(
      seeded.proofId,
      { ...baseBody, padding: "x".repeat(64 * 1_024) },
      `idem_${crypto.randomUUID()}`,
    );
    expect((await appFor(seeded.sellerAuthUserId).fetch(oversized, env)).status).toBe(413);

    const current = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}/reviews`),
      env,
    );
    const history = await appFor(null).fetch(
      new Request(`${origin}/api/v1/proofs/${seeded.proofId}/review-revisions`),
      env,
    );
    expect(`${await current.text()}${await history.text()}`).not.toMatch(
      /marketsUserId|email|token|password|pointsSubject/i,
    );
  });

  it("rejects revision mutation and invalid current pointer updates in D1", async () => {
    const seeded = await seedProof();
    const created = await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { comment: "Immutable", completionProofUrl: null, rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );
    const revisionId = created.body.data!.revisionId;
    await expect(
      env.DB.prepare("UPDATE proof_review_revisions SET rating = 1 WHERE id = ?")
        .bind(revisionId)
        .run(),
    ).rejects.toThrow("PROOF_REVIEW_REVISION_IMMUTABLE");
    await expect(
      env.DB.prepare("DELETE FROM proof_review_revisions WHERE id = ?").bind(revisionId).run(),
    ).rejects.toThrow("PROOF_REVIEW_REVISION_IMMUTABLE");
    await expect(
      env.DB.prepare("UPDATE proof_reviews SET revision_number = 99 WHERE proof_id = ?")
        .bind(seeded.proofId)
        .run(),
    ).rejects.toThrow("PROOF_REVIEW_CURRENT_POINTER_INVALID");
  });

  it("rejects a current pointer update to a missing revision", async () => {
    const seeded = await seedProof();
    await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { comment: "Initial", completionProofUrl: null, rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );

    await expect(
      env.DB.prepare(
        `UPDATE proof_reviews
         SET current_revision_id = 'proof-review-revision_missing',
             revision_number = 2,
             updated_at = '9999-12-31T23:59:59.999Z'
         WHERE proof_id = ? AND direction = 'SELLER_TO_BUYER'`,
      )
        .bind(seeded.proofId)
        .run(),
    ).rejects.toThrow("PROOF_REVIEW_CURRENT_POINTER_INVALID");
  });

  it("rejects a current pointer update to another review revision", async () => {
    const seeded = await seedProof();
    await postReview(
      seeded.sellerAuthUserId,
      seeded.proofId,
      { comment: "Seller", completionProofUrl: null, rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );
    await postReview(
      seeded.buyerAuthUserId,
      seeded.proofId,
      { comment: "Buyer 1", completionProofUrl: null, rating: 5 },
      `idem_${crypto.randomUUID()}`,
    );
    const buyerRevisionTwo = await postReview(
      seeded.buyerAuthUserId,
      seeded.proofId,
      { comment: "Buyer 2", completionProofUrl: null, rating: 4 },
      `idem_${crypto.randomUUID()}`,
    );
    await postReview(
      seeded.buyerAuthUserId,
      seeded.proofId,
      { comment: "Buyer 3", completionProofUrl: null, rating: 3 },
      `idem_${crypto.randomUUID()}`,
    );

    await expect(
      env.DB.prepare(
        `UPDATE proof_reviews
         SET current_revision_id = ?, revision_number = 2,
             updated_at = '9999-12-31T23:59:59.999Z'
         WHERE proof_id = ? AND direction = 'SELLER_TO_BUYER'`,
      )
        .bind(buyerRevisionTwo.body.data!.revisionId, seeded.proofId)
        .run(),
    ).rejects.toThrow("PROOF_REVIEW_CURRENT_POINTER_INVALID");
  });
});
