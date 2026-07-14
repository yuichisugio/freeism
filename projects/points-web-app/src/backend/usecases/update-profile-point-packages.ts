import {
  findProfileMutationReplay,
  profileMutationPayloadHash,
} from "./profile-mutation-idempotency";

const OPERATION = "profile-point-packages-update";

export class DuplicatePointPackageError extends Error {
  constructor() {
    super("DUPLICATE_POINT_PACKAGE");
  }
}

export async function updateProfilePointPackages(
  db: D1Database,
  input: { pointsUserId: string; pointPackageIds: string[] },
): Promise<string[]> {
  if (new Set(input.pointPackageIds).size !== input.pointPackageIds.length) {
    throw new DuplicatePointPackageError();
  }

  const statements = [
    db
      .prepare("DELETE FROM profile_point_package WHERE points_user_id = ?")
      .bind(input.pointsUserId),
    ...input.pointPackageIds.map((pointPackageId, displayOrder) =>
      db
        .prepare(
          `INSERT INTO profile_point_package (id, points_user_id, point_package_id, display_order)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(
          `ppp_${input.pointsUserId}_${displayOrder}`,
          input.pointsUserId,
          pointPackageId,
          displayOrder,
        ),
    ),
  ];
  await db.batch(statements);
  return [...input.pointPackageIds];
}

interface PointPackagesResponseBody {
  data: { pointPackageIds: string[] };
  meta: { requestId: string };
}

export async function updateProfilePointPackagesIdempotently(
  db: D1Database,
  input: {
    pointsUserId: string;
    pointPackageIds: string[];
    idempotencyKey: string;
    requestId: string;
  },
): Promise<{ status: number; body: PointPackagesResponseBody }> {
  if (new Set(input.pointPackageIds).size !== input.pointPackageIds.length) {
    throw new DuplicatePointPackageError();
  }
  const payloadHash = await profileMutationPayloadHash({
    pointPackageIds: input.pointPackageIds,
  });
  const replayInput = {
    pointsUserId: input.pointsUserId,
    operation: OPERATION,
    idempotencyKey: input.idempotencyKey,
    payloadHash,
  };
  const replay = await findProfileMutationReplay<PointPackagesResponseBody>(db, replayInput);
  if (replay) {
    return replay;
  }
  const body: PointPackagesResponseBody = {
    data: { pointPackageIds: [...input.pointPackageIds] },
    meta: { requestId: input.requestId },
  };
  try {
    await db.batch([
      db
        .prepare("DELETE FROM profile_point_package WHERE points_user_id = ?")
        .bind(input.pointsUserId),
      db
        .prepare(
          `INSERT INTO profile_point_package
             (id, points_user_id, point_package_id, display_order)
           SELECT ? || '_' || CAST(key AS TEXT), ?, value, CAST(key AS INTEGER)
           FROM json_each(?)`,
        )
        .bind(
          `ppp_${input.pointsUserId}`,
          input.pointsUserId,
          JSON.stringify(input.pointPackageIds),
        ),
      db
        .prepare(
          `INSERT INTO idempotency_results
             (id, actor_points_user_id, operation, idempotency_key, payload_hash,
              status, response_body)
           VALUES (?, ?, ?, ?, ?, 200, ?)`,
        )
        .bind(
          `idemr_${crypto.randomUUID()}`,
          input.pointsUserId,
          OPERATION,
          input.idempotencyKey,
          payloadHash,
          JSON.stringify(body),
        ),
    ]);
  } catch (error) {
    const concurrent = await findProfileMutationReplay<PointPackagesResponseBody>(db, replayInput);
    if (concurrent) {
      return concurrent;
    }
    throw error;
  }
  return { status: 200, body };
}
