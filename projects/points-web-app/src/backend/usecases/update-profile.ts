import { and, eq } from "drizzle-orm";

import { hashCanonicalPayload } from "../domain/idempotency/idempotency-result";
import { createDb } from "../infrastructure/db/client";
import { user } from "../infrastructure/db/schema/auth";
import { idempotencyResults } from "../infrastructure/db/schema/idempotency";
import { pointsUsers } from "../infrastructure/db/schema/points-user";
import { profiles } from "../infrastructure/db/schema/profile";

const PROFILE_UPDATE_OPERATION = "profile-update";

export interface ProfileDto {
  pointsUserId: string;
  displayName: string;
  description: string;
  externalUrls: string[];
  visibility: "PUBLIC" | "PRIVATE";
  pointPackages: [];
  evaluationVisibilities: [];
}

export interface ProfileUpdateBody {
  displayName: string;
  description: string;
  externalUrls: string[];
  visibility: "PUBLIC" | "PRIVATE";
}

export interface ProfileResponseBody {
  data: ProfileDto;
  meta: { requestId: string };
}

export class InvalidProfileError extends Error {
  constructor() {
    super("INVALID_PROFILE");
  }
}

export class IdempotencyKeyReusedError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED");
  }
}

function defaultDisplayName(name: string, pointsUserId: string): string {
  const trimmed = name.trim();
  return (trimmed.length === 0 ? pointsUserId : trimmed).slice(0, 100);
}

function toProfileDto(row: {
  pointsUserId: string;
  authDisplayName: string;
  displayName: string | null;
  description: string | null;
  externalUrls: string[] | null;
  visibility: "PUBLIC" | "PRIVATE" | null;
}): ProfileDto {
  return {
    pointsUserId: row.pointsUserId,
    displayName: row.displayName ?? defaultDisplayName(row.authDisplayName, row.pointsUserId),
    description: row.description ?? "",
    externalUrls: row.externalUrls ?? [],
    visibility: row.visibility ?? "PUBLIC",
    pointPackages: [],
    evaluationVisibilities: [],
  };
}

export function parseProfileUpdateBody(value: unknown): ProfileUpdateBody {
  if (!value || typeof value !== "object") {
    throw new InvalidProfileError();
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.displayName !== "string" ||
    input.displayName.length < 1 ||
    input.displayName.length > 100 ||
    typeof input.description !== "string" ||
    input.description.length > 500 ||
    !Array.isArray(input.externalUrls) ||
    input.externalUrls.length > 30 ||
    !input.externalUrls.every((url) => typeof url === "string") ||
    (input.visibility !== "PUBLIC" && input.visibility !== "PRIVATE")
  ) {
    throw new InvalidProfileError();
  }
  return {
    displayName: input.displayName,
    description: input.description,
    externalUrls: input.externalUrls,
    visibility: input.visibility,
  };
}

async function selectProfile(database: ReturnType<typeof createDb>, pointsUserId: string) {
  const [row] = await database
    .select({
      pointsUserId: pointsUsers.id,
      authDisplayName: user.name,
      displayName: profiles.displayName,
      description: profiles.description,
      externalUrls: profiles.externalUrls,
      visibility: profiles.visibility,
    })
    .from(pointsUsers)
    .innerJoin(user, eq(pointsUsers.authUserId, user.id))
    .leftJoin(profiles, eq(pointsUsers.id, profiles.pointsUserId))
    .where(eq(pointsUsers.id, pointsUserId))
    .limit(1);
  if (!row) {
    throw new Error("POINTS_USER_NOT_FOUND");
  }
  return toProfileDto(row);
}

export async function getProfile(databaseBinding: D1Database, pointsUserId: string) {
  return selectProfile(createDb(databaseBinding), pointsUserId);
}

async function findIdempotencyResult(
  database: ReturnType<typeof createDb>,
  actorPointsUserId: string,
  idempotencyKey: string,
) {
  const [result] = await database
    .select({
      payloadHash: idempotencyResults.payloadHash,
      responseBody: idempotencyResults.responseBody,
      status: idempotencyResults.status,
    })
    .from(idempotencyResults)
    .where(
      and(
        eq(idempotencyResults.actorPointsUserId, actorPointsUserId),
        eq(idempotencyResults.operation, PROFILE_UPDATE_OPERATION),
        eq(idempotencyResults.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return result;
}

function replayOrConflict(
  result: Awaited<ReturnType<typeof findIdempotencyResult>>,
  payloadHash: string,
) {
  if (!result) {
    return null;
  }
  if (result.payloadHash !== payloadHash) {
    throw new IdempotencyKeyReusedError();
  }
  return {
    status: result.status,
    body: result.responseBody as ProfileResponseBody,
  };
}

export async function updateProfile(
  databaseBinding: D1Database,
  input: {
    actorPointsUserId: string;
    body: ProfileUpdateBody;
    idempotencyKey: string;
    requestId: string;
  },
): Promise<{ status: number; body: ProfileResponseBody }> {
  const database = createDb(databaseBinding);
  const canonicalPayload = {
    description: input.body.description,
    displayName: input.body.displayName,
    externalUrls: input.body.externalUrls,
    visibility: input.body.visibility,
  };
  const payloadHash = await hashCanonicalPayload(canonicalPayload);
  const replay = replayOrConflict(
    await findIdempotencyResult(database, input.actorPointsUserId, input.idempotencyKey),
    payloadHash,
  );
  if (replay) {
    return replay;
  }

  const profile: ProfileDto = {
    pointsUserId: input.actorPointsUserId,
    ...input.body,
    pointPackages: [],
    evaluationVisibilities: [],
  };
  const body: ProfileResponseBody = {
    data: profile,
    meta: { requestId: input.requestId },
  };

  try {
    await database.batch([
      database
        .insert(profiles)
        .values({
          pointsUserId: input.actorPointsUserId,
          displayName: input.body.displayName,
          description: input.body.description,
          externalUrls: input.body.externalUrls,
          visibility: input.body.visibility,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: profiles.pointsUserId,
          set: {
            displayName: input.body.displayName,
            description: input.body.description,
            externalUrls: input.body.externalUrls,
            visibility: input.body.visibility,
            updatedAt: new Date(),
          },
        }),
      database.insert(idempotencyResults).values({
        id: `idemr_${crypto.randomUUID()}`,
        actorPointsUserId: input.actorPointsUserId,
        operation: PROFILE_UPDATE_OPERATION,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        status: 200,
        responseBody: body,
      }),
    ]);
  } catch (error) {
    const concurrentReplay = replayOrConflict(
      await findIdempotencyResult(database, input.actorPointsUserId, input.idempotencyKey),
      payloadHash,
    );
    if (concurrentReplay) {
      return concurrentReplay;
    }
    throw error;
  }

  return { status: 200, body };
}
