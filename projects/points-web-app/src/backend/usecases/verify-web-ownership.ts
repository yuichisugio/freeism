import { normalizeIdentityUrl } from "../domain/ownership/normalize-identity-url";
import { OwnershipClaimError } from "./claim-unclaimed-fixes";
import { previewUnclaimedFixes, type UnclaimedFixClaimPreview } from "./preview-unclaimed-fixes";
import { hasProfileLinkEvidence } from "../ownership/profile-link-evidence";
import { fetchSafePage, SafePageFetchError } from "../ownership/safe-page-fetcher";

const DAY = 86_400_000;
const REVALIDATION_INTERVAL = 30 * DAY;
const REOWNERSHIP_INTERVAL = 5 * DAY;
const REOWNERSHIP_WINDOW = 14 * DAY;

export class WebOwnershipError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function profileUrl(pointsUserId: string): string {
  return `https://points.freeism.app/profiles/${encodeURIComponent(pointsUserId)}`;
}

async function scheduleNextCycle(
  db: D1Database,
  ownershipId: string,
  epochId: string,
  now: number,
): Promise<void> {
  const cycleId = `ovc_${crypto.randomUUID()}`;
  await db.batch([
    db
      .prepare(
        `UPDATE ownership_revalidation_job
         SET status = 'FAILED', completed_at = ?, error_code = 'SUPERSEDED'
         WHERE identity_ownership_id = ? AND status IN ('PENDING', 'LEASED')`,
      )
      .bind(now, ownershipId),
    db
      .prepare(
        `INSERT INTO ownership_revalidation_job
           (id, identity_ownership_id, ownership_epoch_id, verification_cycle_id,
            attempt, due_at, status)
         VALUES (?, ?, ?, ?, 1, ?, 'PENDING')`,
      )
      .bind(
        `ovj_${crypto.randomUUID()}`,
        ownershipId,
        epochId,
        cycleId,
        now + REVALIDATION_INTERVAL,
      ),
  ]);
}

async function audit(
  db: D1Database,
  pointsUserId: string,
  action: string,
  target: string,
  requestId: string,
  result: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_event
         (id, actor_points_user_id, action, target, request_id, result)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(`audit_${crypto.randomUUID()}`, pointsUserId, action, target, requestId, result)
    .run();
}

export interface VerifyWebOwnershipResult {
  claimPreview: UnclaimedFixClaimPreview | null;
  identityOwnershipId: string;
  ownershipEpochId: string | null;
  status: "ACTIVE" | "PENDING_REOWNERSHIP";
  successCount: number;
  effectiveAt: number | null;
}

export async function verifyWebOwnership(
  env: { DB: D1Database },
  input: {
    pointsUserId: string;
    requestId: string;
    url: string;
    now?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<VerifyWebOwnershipResult> {
  async function claimPreview(ownershipId: string): Promise<UnclaimedFixClaimPreview | null> {
    try {
      return await previewUnclaimedFixes(env.DB, ownershipId, input.pointsUserId);
    } catch (error) {
      if (error instanceof OwnershipClaimError && error.code === "NO_UNCLAIMED_FIXES") return null;
      throw error;
    }
  }

  const now = input.now ?? Date.now();
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeIdentityUrl(input.url);
  } catch {
    throw new WebOwnershipError("WEB_URL_UNSAFE");
  }
  let page;
  try {
    page = await fetchSafePage(normalizedUrl, input.fetchImpl);
  } catch (error) {
    if (error instanceof SafePageFetchError) throw new WebOwnershipError(error.code);
    throw error;
  }
  if (
    !(await hasProfileLinkEvidence({
      documentUrl: page.finalUrl,
      html: page.text,
      linkHeader: page.linkHeader,
      parseHtml: page.mediaType === "text/html",
      profileUrl: profileUrl(input.pointsUserId),
    }))
  ) {
    throw new WebOwnershipError("WEB_PROFILE_LINK_NOT_FOUND");
  }

  const existing = await env.DB.prepare(
    `SELECT id, points_user_id AS pointsUserId, status,
            current_ownership_epoch_id AS epochId
     FROM identity_ownership
     WHERE identity_type = 'WEB_URL' AND normalized_identity_key = ?`,
  )
    .bind(normalizedUrl)
    .first<{ id: string; pointsUserId: string; status: string; epochId: string }>();

  if (!existing) {
    const ownershipId = `ownership_web_${crypto.randomUUID()}`;
    const epochId = `epoch_web_${crypto.randomUUID()}`;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO identity_ownership
           (id, identity_type, normalized_identity_key, points_user_id, status,
            current_ownership_epoch_id, verified_at, next_verification_at, permanent_correspondence)
         VALUES (?, 'WEB_URL', ?, ?, 'ACTIVE', ?, ?, ?, 0)`,
      ).bind(
        ownershipId,
        normalizedUrl,
        input.pointsUserId,
        epochId,
        now,
        now + REVALIDATION_INTERVAL,
      ),
      env.DB.prepare(
        `INSERT INTO ownership_epoch
           (id, identity_ownership_id, owner_points_user_id, effective_at,
            verification_method, evidence_hash, success_count, request_id, created_at)
         VALUES (?, ?, ?, ?, 'WEB_LINK', ?, 1, ?, ?)`,
      ).bind(epochId, ownershipId, input.pointsUserId, now, page.contentHash, input.requestId, now),
    ]);
    await scheduleNextCycle(env.DB, ownershipId, epochId, now);
    await audit(
      env.DB,
      input.pointsUserId,
      "WEB_OWNERSHIP_VERIFIED",
      ownershipId,
      input.requestId,
      "ACTIVE",
    );
    return {
      claimPreview: await claimPreview(ownershipId),
      effectiveAt: now,
      identityOwnershipId: ownershipId,
      ownershipEpochId: epochId,
      status: "ACTIVE",
      successCount: 1,
    };
  }

  if (existing.status === "ACTIVE" || existing.status === "REVERIFYING") {
    if (existing.pointsUserId !== input.pointsUserId)
      throw new WebOwnershipError("WEB_OWNERSHIP_ALREADY_ACTIVE");
    await env.DB.prepare(
      `UPDATE identity_ownership
       SET status = 'ACTIVE', verified_at = ?, next_verification_at = ?
       WHERE id = ?`,
    )
      .bind(now, now + REVALIDATION_INTERVAL, existing.id)
      .run();
    await scheduleNextCycle(env.DB, existing.id, existing.epochId, now);
    await audit(
      env.DB,
      input.pointsUserId,
      "WEB_OWNERSHIP_REVERIFIED",
      existing.id,
      input.requestId,
      "ACTIVE",
    );
    return {
      claimPreview: await claimPreview(existing.id),
      effectiveAt: null,
      identityOwnershipId: existing.id,
      ownershipEpochId: existing.epochId,
      status: "ACTIVE",
      successCount: 1,
    };
  }

  if (existing.status !== "LAPSED") throw new WebOwnershipError("WEB_OWNERSHIP_STATE_INVALID");
  const candidate = await env.DB.prepare(
    `SELECT candidate_points_user_id AS pointsUserId, first_success_at AS firstSuccessAt,
            last_success_at AS lastSuccessAt, next_eligible_at AS nextEligibleAt,
            success_count AS successCount
     FROM web_reownership_candidate WHERE identity_ownership_id = ?`,
  )
    .bind(existing.id)
    .first<{
      pointsUserId: string;
      firstSuccessAt: number;
      lastSuccessAt: number;
      nextEligibleAt: number;
      successCount: number;
    }>();
  const reset =
    !candidate ||
    candidate.pointsUserId !== input.pointsUserId ||
    now > candidate.firstSuccessAt + REOWNERSHIP_WINDOW;
  const count = reset
    ? 1
    : now < candidate.nextEligibleAt
      ? candidate.successCount
      : candidate.successCount + 1;
  const firstSuccessAt = reset ? now : candidate.firstSuccessAt;
  if (count < 3) {
    const lastSuccessAt =
      reset || !candidate || now >= candidate.nextEligibleAt ? now : candidate.lastSuccessAt;
    await env.DB.prepare(
      `INSERT INTO web_reownership_candidate
         (identity_ownership_id, candidate_points_user_id, first_success_at,
          last_success_at, next_eligible_at, success_count, evidence_hash, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(identity_ownership_id) DO UPDATE SET
         candidate_points_user_id = excluded.candidate_points_user_id,
         first_success_at = excluded.first_success_at,
         last_success_at = excluded.last_success_at,
         next_eligible_at = excluded.next_eligible_at,
         success_count = excluded.success_count,
         evidence_hash = excluded.evidence_hash,
         updated_at = excluded.updated_at`,
    )
      .bind(
        existing.id,
        input.pointsUserId,
        firstSuccessAt,
        lastSuccessAt,
        lastSuccessAt + REOWNERSHIP_INTERVAL,
        count,
        page.contentHash,
        now,
      )
      .run();
    return {
      claimPreview: null,
      effectiveAt: null,
      identityOwnershipId: existing.id,
      ownershipEpochId: null,
      status: "PENDING_REOWNERSHIP",
      successCount: count,
    };
  }

  const epochId = `epoch_web_${crypto.randomUUID()}`;
  const reowned = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO ownership_epoch
         (id, identity_ownership_id, owner_points_user_id, effective_at,
          verification_method, evidence_hash, success_count, request_id, created_at)
       SELECT ?, ownership.id, ?, ?, 'WEB_LINK_REOWNERSHIP', ?, 3, ?, ?
       FROM identity_ownership ownership
       WHERE ownership.id = ? AND ownership.status = 'LAPSED'`,
    ).bind(epochId, input.pointsUserId, now, page.contentHash, input.requestId, now, existing.id),
    env.DB.prepare(
      `UPDATE identity_ownership
       SET points_user_id = ?, status = 'ACTIVE', current_ownership_epoch_id = ?,
           verified_at = ?, next_verification_at = ?
       WHERE id = ? AND status = 'LAPSED'`,
    ).bind(input.pointsUserId, epochId, now, now + REVALIDATION_INTERVAL, existing.id),
    env.DB.prepare("DELETE FROM web_reownership_candidate WHERE identity_ownership_id = ?").bind(
      existing.id,
    ),
  ]);
  if ((reowned[0]?.meta.changes ?? 0) !== 1) throw new WebOwnershipError("WEB_REOWNERSHIP_CHANGED");
  await scheduleNextCycle(env.DB, existing.id, epochId, now);
  await audit(
    env.DB,
    input.pointsUserId,
    "WEB_OWNERSHIP_REOWNED",
    existing.id,
    input.requestId,
    "ACTIVE",
  );
  return {
    claimPreview: await claimPreview(existing.id),
    effectiveAt: now,
    identityOwnershipId: existing.id,
    ownershipEpochId: epochId,
    status: "ACTIVE",
    successCount: 3,
  };
}
