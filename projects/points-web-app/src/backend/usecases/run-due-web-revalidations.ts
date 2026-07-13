import { hasProfileLinkEvidence } from "../ownership/profile-link-evidence";
import { fetchSafePage } from "../ownership/safe-page-fetcher";
import { lapseWebOwnership } from "./lapse-web-ownership";

const DAY = 86_400_000;
const LEASE = 5 * 60_000;
const LAG_THRESHOLD = 15 * 60_000;

interface DueJob {
  id: string;
  identityOwnershipId: string;
  ownershipEpochId: string;
  verificationCycleId: string;
  attempt: number;
  dueAt: number;
  cycleStartedAt: number | null;
  pointsUserId: string;
}

function profileUrl(pointsUserId: string): string {
  return `https://points.freeism.app/profiles/${encodeURIComponent(pointsUserId)}`;
}

async function hashId(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function openLagAlert(db: D1Database, ownershipId: string, now: number): Promise<void> {
  const resourceHash = await hashId(ownershipId);
  await db
    .prepare(
      `INSERT INTO ops_alert
         (alert_key, type, resource_id_hash, status, first_observed_at,
          last_observed_at, repeat_count, safe_detail_code)
       VALUES (?, 'OWNERSHIP_SCHEDULER_LAG', ?, 'OPEN', ?, ?, 1, 'DUE_OVER_15_MINUTES')
       ON CONFLICT(alert_key) DO UPDATE SET
         status = 'OPEN', last_observed_at = excluded.last_observed_at,
         resolved_at = NULL, repeat_count = ops_alert.repeat_count + 1`,
    )
    .bind(`ownership-scheduler-lag:${resourceHash}`, resourceHash, now, now)
    .run();
}

async function resolveLagAlert(db: D1Database, ownershipId: string, now: number): Promise<void> {
  const resourceHash = await hashId(ownershipId);
  await db
    .prepare(
      `UPDATE ops_alert
       SET status = 'RESOLVED', last_observed_at = ?, resolved_at = ?
       WHERE alert_key = ? AND status = 'OPEN'`,
    )
    .bind(now, now, `ownership-scheduler-lag:${resourceHash}`)
    .run();
}

async function leaseDueJobs(db: D1Database, now: number): Promise<DueJob[]> {
  const due = await db
    .prepare(
      `SELECT job.id, job.identity_ownership_id AS identityOwnershipId,
              job.ownership_epoch_id AS ownershipEpochId,
              job.verification_cycle_id AS verificationCycleId,
              job.attempt, job.due_at AS dueAt, job.cycle_started_at AS cycleStartedAt,
              ownership.points_user_id AS pointsUserId
       FROM ownership_revalidation_job job
       JOIN identity_ownership ownership ON ownership.id = job.identity_ownership_id
       WHERE job.due_at <= ?
         AND (job.status = 'PENDING' OR (job.status = 'LEASED' AND job.lease_until <= ?))
         AND ownership.identity_type = 'WEB_URL'
         AND ownership.current_ownership_epoch_id = job.ownership_epoch_id
         AND ownership.status IN ('ACTIVE', 'REVERIFYING')
       ORDER BY job.due_at, job.id
       LIMIT 50`,
    )
    .bind(now, now)
    .all<DueJob>();
  const leased: DueJob[] = [];
  for (const job of due.results) {
    const result = await db
      .prepare(
        `UPDATE ownership_revalidation_job
         SET status = 'LEASED', lease_until = ?
         WHERE id = ? AND (status = 'PENDING' OR (status = 'LEASED' AND lease_until <= ?))`,
      )
      .bind(now + LEASE, job.id, now)
      .run();
    if ((result.meta.changes ?? 0) === 1) leased.push(job);
  }
  return leased;
}

export async function runDueWebRevalidations(
  db: D1Database,
  now: number = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<{ leased: number; succeeded: number; failed: number; lapsed: number }> {
  const jobs = await leaseDueJobs(db, now);
  let succeeded = 0;
  let failed = 0;
  let lapsed = 0;
  for (const job of jobs) {
    if (now - job.dueAt > LAG_THRESHOLD) await openLagAlert(db, job.identityOwnershipId, now);
    const revalidating = await db
      .prepare(
        `UPDATE identity_ownership SET status = 'REVERIFYING'
         WHERE id = ? AND identity_type = 'WEB_URL'
           AND current_ownership_epoch_id = ?
           AND status IN ('ACTIVE', 'REVERIFYING')`,
      )
      .bind(job.identityOwnershipId, job.ownershipEpochId)
      .run();
    if ((revalidating.meta.changes ?? 0) !== 1) {
      await db
        .prepare(
          `UPDATE ownership_revalidation_job
           SET status = 'FAILED', completed_at = ?, lease_until = NULL,
               error_code = 'OWNERSHIP_STATE_CHANGED'
           WHERE id = ? AND status = 'LEASED'`,
        )
        .bind(now, job.id)
        .run();
      continue;
    }
    const ownership = await db
      .prepare("SELECT normalized_identity_key AS url FROM identity_ownership WHERE id = ?")
      .bind(job.identityOwnershipId)
      .first<{ url: string }>();
    let verified = false;
    try {
      if (!ownership) throw new Error("OWNERSHIP_NOT_FOUND");
      const page = await fetchSafePage(ownership.url, fetchImpl);
      verified = await hasProfileLinkEvidence({
        documentUrl: page.finalUrl,
        html: page.text,
        linkHeader: page.linkHeader,
        parseHtml: page.mediaType === "text/html",
        profileUrl: profileUrl(job.pointsUserId),
      });
    } catch {
      verified = false;
    }
    if (verified) {
      const nextCycleId = `ovc_${crypto.randomUUID()}`;
      const activated = await db
        .prepare(
          `UPDATE identity_ownership
           SET status = 'ACTIVE', verified_at = ?, next_verification_at = ?
           WHERE id = ? AND identity_type = 'WEB_URL'
             AND current_ownership_epoch_id = ? AND status = 'REVERIFYING'`,
        )
        .bind(now, now + 30 * DAY, job.identityOwnershipId, job.ownershipEpochId)
        .run();
      if ((activated.meta.changes ?? 0) !== 1) {
        await db
          .prepare(
            `UPDATE ownership_revalidation_job
             SET status = 'FAILED', completed_at = ?, lease_until = NULL,
                 error_code = 'OWNERSHIP_STATE_CHANGED'
             WHERE id = ? AND status = 'LEASED'`,
          )
          .bind(now, job.id)
          .run();
        continue;
      }
      await db.batch([
        db
          .prepare(
            `UPDATE ownership_revalidation_job
             SET status = 'SUCCEEDED', completed_at = ?, lease_until = NULL, error_code = NULL
             WHERE id = ? AND status = 'LEASED'`,
          )
          .bind(now, job.id),
        db
          .prepare(
            `INSERT INTO ownership_revalidation_job
               (id, identity_ownership_id, ownership_epoch_id, verification_cycle_id,
                attempt, due_at, status)
             VALUES (?, ?, ?, ?, 1, ?, 'PENDING')`,
          )
          .bind(
            `ovj_${crypto.randomUUID()}`,
            job.identityOwnershipId,
            job.ownershipEpochId,
            nextCycleId,
            now + 30 * DAY,
          ),
      ]);
      await resolveLagAlert(db, job.identityOwnershipId, now);
      succeeded += 1;
      continue;
    }

    failed += 1;
    const cycleStartedAt = job.cycleStartedAt ?? now;
    await db
      .prepare(
        `UPDATE ownership_revalidation_job
         SET status = 'FAILED', completed_at = ?, lease_until = NULL,
             cycle_started_at = ?, error_code = 'VERIFICATION_FAILED'
         WHERE id = ? AND status = 'LEASED'`,
      )
      .bind(now, cycleStartedAt, job.id)
      .run();
    if (job.attempt >= 3) {
      await lapseWebOwnership(db, job.identityOwnershipId, job.ownershipEpochId, now);
      await resolveLagAlert(db, job.identityOwnershipId, now);
      lapsed += 1;
      continue;
    }
    const nextAttempt = job.attempt + 1;
    const nextDueAt = cycleStartedAt + (nextAttempt === 2 ? 3 * DAY : 7 * DAY);
    await db
      .prepare(
        `INSERT OR IGNORE INTO ownership_revalidation_job
           (id, identity_ownership_id, ownership_epoch_id, verification_cycle_id,
            attempt, due_at, cycle_started_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      )
      .bind(
        `ovj_${crypto.randomUUID()}`,
        job.identityOwnershipId,
        job.ownershipEpochId,
        job.verificationCycleId,
        nextAttempt,
        nextDueAt,
        cycleStartedAt,
      )
      .run();
  }
  return { failed, lapsed, leased: jobs.length, succeeded };
}
