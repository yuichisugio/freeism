import { z } from "zod";

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const opaqueIdSchema = z.string().min(1).max(255);
const reservationKeySchema = z.string().min(1).max(512);
const sha256HashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const utcInstantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/);
const priceTicksSchema = z.number().int().min(0).max(MAX_SAFE_INTEGER);
const positiveSafeIntegerSchema = z.number().int().min(1).max(MAX_SAFE_INTEGER);

const userScopeSchema = z.enum([
  "openid",
  "profile",
  "offline_access",
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
]);

function uniqueItems<T extends z.ZodTypeAny>(schema: z.ZodArray<T>) {
  return schema.refine((items) => new Set(items).size === items.length);
}

export const createLinkAttemptRequestSchema = z
  .object({
    marketsUserId: opaqueIdSchema,
    stateHash: sha256HashSchema,
    pkceChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    redirectUri: z.string().url(),
    requestedScopes: uniqueItems(z.array(userScopeSchema).min(1)),
    expiresAt: utcInstantSchema,
    returnUrlHash: sha256HashSchema,
  })
  .strict();

export const finalizeLinkAttemptRequestSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      outcome: z.literal("CONFIRM"),
      marketsPointsConnectionId: opaqueIdSchema,
      attemptPayloadHash: sha256HashSchema,
      pointsIssuer: z.string().url(),
      pointsSubject: opaqueIdSchema,
      userClientId: opaqueIdSchema,
    })
    .strict(),
  z
    .object({
      outcome: z.literal("CANCEL"),
      marketsPointsConnectionId: opaqueIdSchema,
      attemptPayloadHash: sha256HashSchema,
    })
    .strict(),
]);

export const auctionEligibilityRequestSchema = z
  .object({
    auctionCommandId: opaqueIdSchema,
    auctionCommandHash: sha256HashSchema,
    items: z
      .array(
        z
          .object({
            auctionItemId: opaqueIdSchema,
            pointPackageId: opaqueIdSchema,
            pointPackageRevisionId: opaqueIdSchema,
            contentHash: sha256HashSchema,
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict();

export const balanceCheckRequestSchema = z
  .object({
    pointPackageRevisionId: opaqueIdSchema,
    priceTicks: priceTicksSchema,
    quantity: positiveSafeIntegerSchema,
  })
  .strict();

export const createReservationRequestSchema = z
  .object({
    reservationKey: reservationKeySchema,
    marketsUserId: opaqueIdSchema,
    auctionId: opaqueIdSchema,
    settlementId: opaqueIdSchema,
    planHash: sha256HashSchema,
    pointPackageRevisionId: opaqueIdSchema,
    priceTicks: priceTicksSchema,
    quantity: positiveSafeIntegerSchema,
    leaseSeconds: z.literal(900),
  })
  .strict();

export const reservationStatusRequestSchema = z.discriminatedUnion("lookupBy", [
  z
    .object({
      lookupBy: z.literal("POINT_RESERVATION_ID"),
      pointReservationIds: uniqueItems(z.array(opaqueIdSchema).min(1)),
    })
    .strict(),
  z
    .object({
      lookupBy: z.literal("RESERVATION_KEY"),
      reservationKeys: uniqueItems(z.array(reservationKeySchema).min(1)),
    })
    .strict(),
]);

export const captureSettlementRequestSchema = z
  .object({
    auctionId: opaqueIdSchema,
    planHash: sha256HashSchema,
    reservations: z
      .array(
        z
          .object({
            pointReservationId: opaqueIdSchema,
            expectedVectorHash: sha256HashSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const releaseReservationRequestSchema = z
  .object({
    pointReservationId: opaqueIdSchema,
    reason: z.string().min(1).max(1000),
    planHash: sha256HashSchema,
  })
  .strict();

export const deactivateConnectionRequestSchema = z
  .object({
    pointsConnectionId: opaqueIdSchema,
    reason: z.string().min(1).max(1000),
    deactivationKey: opaqueIdSchema,
  })
  .strict();
