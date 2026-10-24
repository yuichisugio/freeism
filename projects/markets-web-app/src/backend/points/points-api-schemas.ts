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
const nonNegativeSafeIntegerSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(MAX_SAFE_INTEGER),
);
const signedIntegerStringSchema = v.pipe(v.string(), v.regex(/^-?(0|[1-9][0-9]*)$/));
const nonNegativeIntegerStringSchema = v.pipe(v.string(), v.regex(/^(0|[1-9][0-9]*)$/));

const userScopeSchema = v.picklist([
  "openid",
  "profile",
  "offline_access",
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
]);

const requestMetaSchema = v.strictObject({ requestId: opaqueIdSchema });

function uniqueItems<T extends v.GenericSchema<unknown[]>>(schema: T) {
  return v.pipe(
    schema,
    v.check((items) => new Set(items).size === items.length),
  );
}

function envelope<T extends v.GenericSchema>(data: T) {
  return v.strictObject({ data, meta: requestMetaSchema });
}

export const createLinkAttemptRequestSchema = v.strictObject({
  marketsUserId: opaqueIdSchema,
  stateHash: sha256HashSchema,
  pkceChallenge: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/)),
  redirectUri: v.pipe(v.string(), v.url()),
  requestedScopes: uniqueItems(v.pipe(v.array(userScopeSchema), v.minLength(1))),
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

export const auctionEligibilityRequestItemSchema = v.strictObject({
  auctionItemId: opaqueIdSchema,
  pointPackageId: opaqueIdSchema,
  pointPackageRevisionId: opaqueIdSchema,
  contentHash: sha256HashSchema,
});

export const auctionEligibilityRequestSchema = v.strictObject({
  auctionCommandId: opaqueIdSchema,
  auctionCommandHash: sha256HashSchema,
  items: v.pipe(v.array(auctionEligibilityRequestItemSchema), v.minLength(1), v.maxLength(1000)),
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
    pointReservationIds: uniqueItems(v.pipe(v.array(opaqueIdSchema), v.minLength(1))),
  }),
  v.strictObject({
    lookupBy: v.literal("RESERVATION_KEY"),
    reservationKeys: uniqueItems(v.pipe(v.array(reservationKeySchema), v.minLength(1))),
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

export const publicPointPackageRevisionComponentSchema = v.strictObject({
  evaluationCriterionId: opaqueIdSchema,
  evaluationCriterionRevisionId: opaqueIdSchema,
  name: v.pipe(v.string(), v.minLength(1)),
  displayOrder: nonNegativeSafeIntegerSchema,
  weight: positiveSafeIntegerSchema,
  minimumUnitScaled: signedIntegerStringSchema,
  buyNowEnabled: v.boolean(),
});

export const publicPointPackageRevisionDataSchema = v.strictObject({
  pointPackageId: opaqueIdSchema,
  pointPackageRevisionId: opaqueIdSchema,
  status: v.picklist(["ACTIVE", "INACTIVE"]),
  name: v.pipe(v.string(), v.minLength(1)),
  description: v.nullable(v.string()),
  relatedUrl: v.nullable(v.pipe(v.string(), v.url())),
  totalWeight: positiveSafeIntegerSchema,
  packageTick: positiveSafeIntegerSchema,
  contentHash: sha256HashSchema,
  components: v.pipe(v.array(publicPointPackageRevisionComponentSchema), v.minLength(1)),
});

export const publicPointPackageRevisionResponseSchema = envelope(
  publicPointPackageRevisionDataSchema,
);

export const auctionEligibilityResponseSchema = envelope(
  v.strictObject({
    pointPackageAuctionEligibilityReceiptId: opaqueIdSchema,
    auctionCommandId: opaqueIdSchema,
    auctionCommandHash: sha256HashSchema,
    items: v.pipe(
      v.array(
        v.strictObject({
          auctionItemId: opaqueIdSchema,
          pointPackageId: opaqueIdSchema,
          pointPackageRevisionId: opaqueIdSchema,
          contentHash: sha256HashSchema,
          packageEligibilityVersion: positiveSafeIntegerSchema,
        }),
      ),
      v.minLength(1),
    ),
    checkedAt: utcInstantSchema,
    validUntil: utcInstantSchema,
  }),
);

export const auctionEligibilityItemErrorSchema = v.strictObject({
  auctionItemId: opaqueIdSchema,
  code: v.picklist([
    "POINT_PACKAGE_NOT_FOUND",
    "POINT_PACKAGE_REVISION_NOT_FOUND",
    "POINT_PACKAGE_REVISION_MISMATCH",
    "POINT_PACKAGE_REVISION_INACTIVE",
    "POINT_PACKAGE_INACTIVE",
    "CONTENT_HASH_MISMATCH",
  ]),
});

export const createLinkAttemptResponseSchema = envelope(
  v.strictObject({
    linkAttemptId: opaqueIdSchema,
    expiresAt: utcInstantSchema,
  }),
);

export const finalizeLinkAttemptResponseSchema = envelope(
  v.variant("outcome", [
    v.strictObject({
      linkAttemptFinalizationReceiptId: opaqueIdSchema,
      linkAttemptId: opaqueIdSchema,
      marketsPointsConnectionId: opaqueIdSchema,
      outcome: v.literal("CONFIRM"),
      grantStatus: v.literal("ACTIVE"),
      grantVersion: positiveSafeIntegerSchema,
      finalizedAt: utcInstantSchema,
    }),
    v.strictObject({
      linkAttemptFinalizationReceiptId: opaqueIdSchema,
      linkAttemptId: opaqueIdSchema,
      marketsPointsConnectionId: opaqueIdSchema,
      outcome: v.literal("CANCEL"),
      grantStatus: v.literal("CANCELLED"),
      finalizedAt: utcInstantSchema,
    }),
  ]),
);

export const pointsConnectionResponseSchema = envelope(
  v.strictObject({
    pointsConnectionId: opaqueIdSchema,
    issuer: v.pipe(v.string(), v.url()),
    subject: opaqueIdSchema,
    status: v.picklist(["ACTIVE", "REAUTH_REQUIRED"]),
    grantedScopes: uniqueItems(v.pipe(v.array(userScopeSchema), v.minLength(1))),
    grantVersion: positiveSafeIntegerSchema,
    linkedAt: utcInstantSchema,
  }),
);

export const deactivateConnectionResponseSchema = envelope(
  v.strictObject({
    connectionDeactivationReceiptId: opaqueIdSchema,
    pointsConnectionId: opaqueIdSchema,
    status: v.literal("UNLINKED"),
    grantVersion: positiveSafeIntegerSchema,
    reason: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
    deactivatedAt: utcInstantSchema,
  }),
);

export const balanceCheckResponseSchema = envelope(
  v.strictObject({
    pointPackageRevisionId: opaqueIdSchema,
    priceTicks: priceTicksSchema,
    quantity: positiveSafeIntegerSchema,
    vectorHash: sha256HashSchema,
    components: v.pipe(
      v.array(
        v.strictObject({
          evaluationCriterionId: opaqueIdSchema,
          evaluationCriterionRevisionId: opaqueIdSchema,
          requiredAmountScaled: nonNegativeIntegerStringSchema,
          availableBalanceScaled: signedIntegerStringSchema,
          sufficient: v.boolean(),
        }),
      ),
      v.minLength(1),
    ),
    canReserve: v.boolean(),
    checkedAt: utcInstantSchema,
  }),
);

export const createReservationResponseSchema = envelope(
  v.looseObject({
    pointReservationId: opaqueIdSchema,
    reservationKey: reservationKeySchema,
    status: v.literal("ACTIVE"),
    planHash: sha256HashSchema,
    vectorHash: sha256HashSchema,
    expiresAt: utcInstantSchema,
    components: v.optional(
      v.array(
        v.looseObject({
          evaluationCriterionId: opaqueIdSchema,
          evaluationCriterionRevisionId: opaqueIdSchema,
          amountScaled: nonNegativeIntegerStringSchema,
        }),
      ),
      [],
    ),
  }),
);

const reservationStatusItemBase = {
  pointReservationId: opaqueIdSchema,
  reservationKey: reservationKeySchema,
  auctionId: opaqueIdSchema,
  settlementId: opaqueIdSchema,
  planHash: sha256HashSchema,
  vectorHash: sha256HashSchema,
  createdAt: utcInstantSchema,
  expiresAt: utcInstantSchema,
};

export const reservationStatusResponseSchema = envelope(
  v.strictObject({
    items: v.array(
      v.variant("status", [
        v.strictObject({
          ...reservationStatusItemBase,
          status: v.literal("ACTIVE"),
          terminalAt: v.null(),
          terminalReceiptId: v.null(),
        }),
        v.strictObject({
          ...reservationStatusItemBase,
          status: v.literal("CAPTURED"),
          terminalAt: utcInstantSchema,
          terminalReceiptId: opaqueIdSchema,
        }),
        v.strictObject({
          ...reservationStatusItemBase,
          status: v.literal("RELEASED"),
          terminalAt: utcInstantSchema,
          terminalReceiptId: opaqueIdSchema,
        }),
        v.strictObject({
          ...reservationStatusItemBase,
          status: v.literal("EXPIRED"),
          terminalAt: utcInstantSchema,
          terminalReceiptId: v.nullable(opaqueIdSchema),
        }),
      ]),
    ),
  }),
);

export const captureSettlementResponseSchema = envelope(
  v.strictObject({
    captureReceiptId: opaqueIdSchema,
    settlementId: opaqueIdSchema,
    auctionId: opaqueIdSchema,
    planHash: sha256HashSchema,
    status: v.literal("CAPTURED"),
    reservations: v.pipe(
      v.array(
        v.looseObject({
          pointReservationId: opaqueIdSchema,
          vectorHash: sha256HashSchema,
          status: v.literal("CAPTURED"),
        }),
      ),
      v.minLength(1),
    ),
    capturedAt: utcInstantSchema,
    contentHash: sha256HashSchema,
  }),
);

export const releaseReservationResponseSchema = envelope(
  v.strictObject({
    releaseReceiptId: opaqueIdSchema,
    pointReservationId: opaqueIdSchema,
    status: v.literal("RELEASED"),
    reason: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
    planHash: sha256HashSchema,
    releasedAt: utcInstantSchema,
    contentHash: sha256HashSchema,
  }),
);

export type CreateLinkAttemptRequest = v.InferOutput<typeof createLinkAttemptRequestSchema>;
export type FinalizeLinkAttemptRequest = v.InferOutput<typeof finalizeLinkAttemptRequestSchema>;
export type AuctionEligibilityRequest = v.InferOutput<typeof auctionEligibilityRequestSchema>;
export type BalanceCheckRequest = v.InferOutput<typeof balanceCheckRequestSchema>;
export type CreateReservationRequest = v.InferOutput<typeof createReservationRequestSchema>;
export type ReservationStatusRequest = v.InferOutput<typeof reservationStatusRequestSchema>;
export type CaptureSettlementRequest = v.InferOutput<typeof captureSettlementRequestSchema>;
export type ReleaseReservationRequest = v.InferOutput<typeof releaseReservationRequestSchema>;
export type DeactivateConnectionRequest = v.InferOutput<typeof deactivateConnectionRequestSchema>;
export type PublicPointPackageRevisionData = v.InferOutput<
  typeof publicPointPackageRevisionDataSchema
>;
export type PublicPointPackageRevisionResponse = v.InferOutput<
  typeof publicPointPackageRevisionResponseSchema
>;
export type AuctionEligibilityResponse = v.InferOutput<typeof auctionEligibilityResponseSchema>;
export type AuctionEligibilityItemError = v.InferOutput<typeof auctionEligibilityItemErrorSchema>;
export type CreateLinkAttemptResponse = v.InferOutput<typeof createLinkAttemptResponseSchema>;
export type FinalizeLinkAttemptResponse = v.InferOutput<typeof finalizeLinkAttemptResponseSchema>;
export type PointsConnectionResponse = v.InferOutput<typeof pointsConnectionResponseSchema>;
export type DeactivateConnectionResponse = v.InferOutput<typeof deactivateConnectionResponseSchema>;
export type BalanceCheckResponse = v.InferOutput<typeof balanceCheckResponseSchema>;
export type CreateReservationResponse = v.InferOutput<typeof createReservationResponseSchema>;
export type ReservationStatusResponse = v.InferOutput<typeof reservationStatusResponseSchema>;
export type CaptureSettlementResponse = v.InferOutput<typeof captureSettlementResponseSchema>;
export type ReleaseReservationResponse = v.InferOutput<typeof releaseReservationResponseSchema>;
