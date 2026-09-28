import * as v from "valibot";

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const opaqueIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(255));
const reservationKeySchema = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const sha256HashSchema = v.pipe(v.string(), v.regex(/^sha256:[0-9a-f]{64}$/));
const utcInstantSchema = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/),
);
const priceTicksSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_SAFE_INTEGER),
);
const positiveSafeIntegerSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(MAX_SAFE_INTEGER),
);

const userScopeSchema = v.picklist([
  "openid",
  "profile",
  "offline_access",
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
]);

function uniqueItems<TSchema extends v.GenericSchema>(schema: TSchema) {
  return v.pipe(
    v.array(schema),
    v.minLength(1),
    v.check((items) => new Set(items).size === items.length),
  );
}

export const createLinkAttemptRequestSchema = v.strictObject({
  marketsUserId: opaqueIdSchema,
  stateHash: sha256HashSchema,
  pkceChallenge: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/)),
  redirectUri: v.pipe(v.string(), v.url()),
  requestedScopes: uniqueItems(userScopeSchema),
  expiresAt: utcInstantSchema,
  returnUrlHash: sha256HashSchema,
});

export const finalizeLinkAttemptRequestSchema = v.variant("outcome", [
  v.strictObject({
    outcome: v.literal("CONFIRM"),
    marketsPointsConnectionId: opaqueIdSchema,
    attemptPayloadHash: sha256HashSchema,
    pointsIssuer: v.pipe(v.string(), v.url()),
    pointsSubject: opaqueIdSchema,
    userClientId: opaqueIdSchema,
  }),
  v.strictObject({
    outcome: v.literal("CANCEL"),
    marketsPointsConnectionId: opaqueIdSchema,
    attemptPayloadHash: sha256HashSchema,
  }),
]);

export const auctionEligibilityRequestSchema = v.strictObject({
  auctionCommandId: opaqueIdSchema,
  auctionCommandHash: sha256HashSchema,
  items: v.pipe(
    v.array(
      v.strictObject({
        auctionItemId: opaqueIdSchema,
        pointPackageId: opaqueIdSchema,
        pointPackageRevisionId: opaqueIdSchema,
        contentHash: sha256HashSchema,
      }),
    ),
    v.minLength(1),
    v.maxLength(1000),
  ),
});

export const balanceCheckRequestSchema = v.strictObject({
  pointPackageRevisionId: opaqueIdSchema,
  priceTicks: priceTicksSchema,
  quantity: positiveSafeIntegerSchema,
});

export const createReservationRequestSchema = v.strictObject({
  reservationKey: reservationKeySchema,
  marketsUserId: opaqueIdSchema,
  auctionId: opaqueIdSchema,
  settlementId: opaqueIdSchema,
  planHash: sha256HashSchema,
  pointPackageRevisionId: opaqueIdSchema,
  priceTicks: priceTicksSchema,
  quantity: positiveSafeIntegerSchema,
  leaseSeconds: v.literal(900),
});

export const reservationStatusRequestSchema = v.variant("lookupBy", [
  v.strictObject({
    lookupBy: v.literal("POINT_RESERVATION_ID"),
    pointReservationIds: uniqueItems(opaqueIdSchema),
  }),
  v.strictObject({
    lookupBy: v.literal("RESERVATION_KEY"),
    reservationKeys: uniqueItems(reservationKeySchema),
  }),
]);

export const captureSettlementRequestSchema = v.strictObject({
  auctionId: opaqueIdSchema,
  planHash: sha256HashSchema,
  reservations: v.pipe(
    v.array(
      v.strictObject({
        pointReservationId: opaqueIdSchema,
        expectedVectorHash: sha256HashSchema,
      }),
    ),
    v.minLength(1),
  ),
});

export const releaseReservationRequestSchema = v.strictObject({
  pointReservationId: opaqueIdSchema,
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  planHash: sha256HashSchema,
});

export const deactivateConnectionRequestSchema = v.strictObject({
  pointsConnectionId: opaqueIdSchema,
  reason: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  deactivationKey: opaqueIdSchema,
});
