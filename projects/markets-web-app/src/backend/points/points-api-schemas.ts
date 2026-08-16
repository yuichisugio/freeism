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
const nonNegativeSafeIntegerSchema = z.number().int().min(0).max(MAX_SAFE_INTEGER);
const signedIntegerStringSchema = z.string().regex(/^-?(0|[1-9][0-9]*)$/);
const nonNegativeIntegerStringSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);

const userScopeSchema = z.enum([
  "openid",
  "profile",
  "offline_access",
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
]);

const requestMetaSchema = z.object({ requestId: opaqueIdSchema }).strict();

function uniqueItems<T extends z.ZodTypeAny>(schema: z.ZodArray<T>) {
  return schema.refine((items) => new Set(items).size === items.length);
}

function envelope<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data, meta: requestMetaSchema }).strict();
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

export const auctionEligibilityRequestItemSchema = z
  .object({
    auctionItemId: opaqueIdSchema,
    pointPackageId: opaqueIdSchema,
    pointPackageRevisionId: opaqueIdSchema,
    contentHash: sha256HashSchema,
  })
  .strict();

export const auctionEligibilityRequestSchema = z
  .object({
    auctionCommandId: opaqueIdSchema,
    auctionCommandHash: sha256HashSchema,
    items: z.array(auctionEligibilityRequestItemSchema).min(1).max(1000),
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

export const publicPointPackageRevisionComponentSchema = z
  .object({
    evaluationCriterionId: opaqueIdSchema,
    evaluationCriterionRevisionId: opaqueIdSchema,
    name: z.string().min(1),
    displayOrder: nonNegativeSafeIntegerSchema,
    weight: positiveSafeIntegerSchema,
    minimumUnitScaled: signedIntegerStringSchema,
    buyNowEnabled: z.boolean(),
  })
  .strict();

export const publicPointPackageRevisionDataSchema = z
  .object({
    pointPackageId: opaqueIdSchema,
    pointPackageRevisionId: opaqueIdSchema,
    status: z.enum(["ACTIVE", "INACTIVE"]),
    name: z.string().min(1),
    description: z.string().nullable(),
    relatedUrl: z.string().url().nullable(),
    totalWeight: positiveSafeIntegerSchema,
    packageTick: positiveSafeIntegerSchema,
    contentHash: sha256HashSchema,
    components: z.array(publicPointPackageRevisionComponentSchema).min(1),
  })
  .strict();

export const publicPointPackageRevisionResponseSchema = envelope(
  publicPointPackageRevisionDataSchema,
);

export const auctionEligibilityResponseSchema = envelope(
  z
    .object({
      pointPackageAuctionEligibilityReceiptId: opaqueIdSchema,
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
              packageEligibilityVersion: positiveSafeIntegerSchema,
            })
            .strict(),
        )
        .min(1),
      checkedAt: utcInstantSchema,
      validUntil: utcInstantSchema,
    })
    .strict(),
);

export const auctionEligibilityItemErrorSchema = z
  .object({
    auctionItemId: opaqueIdSchema,
    code: z.enum([
      "POINT_PACKAGE_NOT_FOUND",
      "POINT_PACKAGE_REVISION_NOT_FOUND",
      "POINT_PACKAGE_REVISION_MISMATCH",
      "POINT_PACKAGE_REVISION_INACTIVE",
      "POINT_PACKAGE_INACTIVE",
      "CONTENT_HASH_MISMATCH",
    ]),
  })
  .strict();

export const createLinkAttemptResponseSchema = envelope(
  z
    .object({
      linkAttemptId: opaqueIdSchema,
      expiresAt: utcInstantSchema,
    })
    .strict(),
);

export const finalizeLinkAttemptResponseSchema = envelope(
  z.discriminatedUnion("outcome", [
    z
      .object({
        linkAttemptFinalizationReceiptId: opaqueIdSchema,
        linkAttemptId: opaqueIdSchema,
        marketsPointsConnectionId: opaqueIdSchema,
        outcome: z.literal("CONFIRM"),
        grantStatus: z.literal("ACTIVE"),
        finalizedAt: utcInstantSchema,
      })
      .strict(),
    z
      .object({
        linkAttemptFinalizationReceiptId: opaqueIdSchema,
        linkAttemptId: opaqueIdSchema,
        marketsPointsConnectionId: opaqueIdSchema,
        outcome: z.literal("CANCEL"),
        grantStatus: z.literal("CANCELLED"),
        finalizedAt: utcInstantSchema,
      })
      .strict(),
  ]),
);

export const pointsConnectionResponseSchema = envelope(
  z
    .object({
      pointsConnectionId: opaqueIdSchema,
      issuer: z.string().url(),
      subject: opaqueIdSchema,
      status: z.enum(["ACTIVE", "REAUTH_REQUIRED"]),
      grantedScopes: uniqueItems(z.array(userScopeSchema).min(1)),
      grantVersion: positiveSafeIntegerSchema,
      linkedAt: utcInstantSchema,
    })
    .strict(),
);

export const deactivateConnectionResponseSchema = envelope(
  z
    .object({
      connectionDeactivationReceiptId: opaqueIdSchema,
      pointsConnectionId: opaqueIdSchema,
      status: z.literal("UNLINKED"),
      grantVersion: positiveSafeIntegerSchema,
      reason: z.string().min(1).max(1000),
      deactivatedAt: utcInstantSchema,
    })
    .strict(),
);

export const balanceCheckResponseSchema = envelope(
  z
    .object({
      pointPackageRevisionId: opaqueIdSchema,
      priceTicks: priceTicksSchema,
      quantity: positiveSafeIntegerSchema,
      vectorHash: sha256HashSchema,
      components: z
        .array(
          z
            .object({
              evaluationCriterionId: opaqueIdSchema,
              evaluationCriterionRevisionId: opaqueIdSchema,
              requiredAmountScaled: nonNegativeIntegerStringSchema,
              availableBalanceScaled: signedIntegerStringSchema,
              sufficient: z.boolean(),
            })
            .strict(),
        )
        .min(1),
      canReserve: z.boolean(),
      checkedAt: utcInstantSchema,
    })
    .strict(),
);

export const createReservationResponseSchema = envelope(
  z
    .object({
      pointReservationId: opaqueIdSchema,
      reservationKey: reservationKeySchema,
      status: z.literal("ACTIVE"),
      planHash: sha256HashSchema,
      vectorHash: sha256HashSchema,
      expiresAt: utcInstantSchema,
      components: z
        .array(
          z
            .object({
              evaluationCriterionId: opaqueIdSchema,
              evaluationCriterionRevisionId: opaqueIdSchema,
              amountScaled: nonNegativeIntegerStringSchema,
            })
            .passthrough(),
        )
        .optional()
        .default([]),
    })
    .passthrough(),
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
  z
    .object({
      items: z.array(
        z.discriminatedUnion("status", [
          z
            .object({
              ...reservationStatusItemBase,
              status: z.literal("ACTIVE"),
              terminalAt: z.null(),
              terminalReceiptId: z.null(),
            })
            .strict(),
          z
            .object({
              ...reservationStatusItemBase,
              status: z.literal("CAPTURED"),
              terminalAt: utcInstantSchema,
              terminalReceiptId: opaqueIdSchema,
            })
            .strict(),
          z
            .object({
              ...reservationStatusItemBase,
              status: z.literal("RELEASED"),
              terminalAt: utcInstantSchema,
              terminalReceiptId: opaqueIdSchema,
            })
            .strict(),
          z
            .object({
              ...reservationStatusItemBase,
              status: z.literal("EXPIRED"),
              terminalAt: utcInstantSchema,
              terminalReceiptId: opaqueIdSchema.nullable(),
            })
            .strict(),
        ]),
      ),
    })
    .strict(),
);

export const captureSettlementResponseSchema = envelope(
  z
    .object({
      captureReceiptId: opaqueIdSchema,
      settlementId: opaqueIdSchema,
      auctionId: opaqueIdSchema,
      planHash: sha256HashSchema,
      status: z.literal("CAPTURED"),
      reservations: z
        .array(
          z
            .object({
              pointReservationId: opaqueIdSchema,
              vectorHash: sha256HashSchema,
              status: z.literal("CAPTURED"),
            })
            .passthrough(),
        )
        .min(1),
      capturedAt: utcInstantSchema,
      contentHash: sha256HashSchema,
    })
    .strict(),
);

export const releaseReservationResponseSchema = envelope(
  z
    .object({
      releaseReceiptId: opaqueIdSchema,
      pointReservationId: opaqueIdSchema,
      status: z.literal("RELEASED"),
      reason: z.string().min(1).max(1000),
      planHash: sha256HashSchema,
      releasedAt: utcInstantSchema,
      contentHash: sha256HashSchema,
    })
    .strict(),
);

export type CreateLinkAttemptRequest = z.infer<typeof createLinkAttemptRequestSchema>;
export type FinalizeLinkAttemptRequest = z.infer<typeof finalizeLinkAttemptRequestSchema>;
export type AuctionEligibilityRequest = z.infer<typeof auctionEligibilityRequestSchema>;
export type BalanceCheckRequest = z.infer<typeof balanceCheckRequestSchema>;
export type CreateReservationRequest = z.infer<typeof createReservationRequestSchema>;
export type ReservationStatusRequest = z.infer<typeof reservationStatusRequestSchema>;
export type CaptureSettlementRequest = z.infer<typeof captureSettlementRequestSchema>;
export type ReleaseReservationRequest = z.infer<typeof releaseReservationRequestSchema>;
export type DeactivateConnectionRequest = z.infer<typeof deactivateConnectionRequestSchema>;
export type PublicPointPackageRevisionData = z.infer<typeof publicPointPackageRevisionDataSchema>;
export type PublicPointPackageRevisionResponse = z.infer<
  typeof publicPointPackageRevisionResponseSchema
>;
export type AuctionEligibilityResponse = z.infer<typeof auctionEligibilityResponseSchema>;
export type AuctionEligibilityItemError = z.infer<typeof auctionEligibilityItemErrorSchema>;
export type CreateLinkAttemptResponse = z.infer<typeof createLinkAttemptResponseSchema>;
export type FinalizeLinkAttemptResponse = z.infer<typeof finalizeLinkAttemptResponseSchema>;
export type PointsConnectionResponse = z.infer<typeof pointsConnectionResponseSchema>;
export type DeactivateConnectionResponse = z.infer<typeof deactivateConnectionResponseSchema>;
export type BalanceCheckResponse = z.infer<typeof balanceCheckResponseSchema>;
export type CreateReservationResponse = z.infer<typeof createReservationResponseSchema>;
export type ReservationStatusResponse = z.infer<typeof reservationStatusResponseSchema>;
export type CaptureSettlementResponse = z.infer<typeof captureSettlementResponseSchema>;
export type ReleaseReservationResponse = z.infer<typeof releaseReservationResponseSchema>;
