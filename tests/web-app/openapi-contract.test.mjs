import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const OPENAPI_PATH = new URL(
  "../../docs/web-app/v0.2/points-markets.openapi.json",
  import.meta.url,
);
const document = JSON.parse(readFileSync(OPENAPI_PATH, "utf8"));
const generatedContract = readFileSync(
  new URL(
    "../../projects/points-web-app/src/generated/points-markets-api.ts",
    import.meta.url,
  ),
  "utf8",
);

const operations = [
  [
    "get",
    "/api/v1/point-package-revisions/{pointPackageRevisionId}",
    "getPublicPointPackageRevision",
    "200",
    null,
    null,
  ],
  [
    "post",
    "/api/v1/point-package-auction-eligibility-checks",
    "checkPointPackageAuctionEligibility",
    "201",
    1_048_576,
    "points.packages.auction-eligibility",
  ],
  [
    "post",
    "/api/v1/oauth/link-attempts",
    "createPointsLinkAttempt",
    "201",
    65_536,
    "points.connection.link-attempt.create",
  ],
  [
    "post",
    "/api/v1/oauth/link-attempts/{linkAttemptId}/finalizations",
    "finalizePointsLinkAttempt",
    "200",
    65_536,
    "points.connection.link-attempt.finalize",
  ],
  [
    "get",
    "/api/v1/me/connection",
    "getPointsConnection",
    "200",
    null,
    "points.connection.read",
  ],
  [
    "post",
    "/api/v1/me/connection-deactivations",
    "deactivatePointsConnection",
    "200",
    65_536,
    "points.connection.unlink",
  ],
  [
    "post",
    "/api/v1/me/balance-checks",
    "checkPointBalance",
    "200",
    65_536,
    "points.balance.read",
  ],
  [
    "post",
    "/api/v1/me/point-reservations",
    "createPointReservation",
    "201",
    65_536,
    "points.reservations.create",
  ],
  [
    "post",
    "/api/v1/point-reservations/status",
    "getPointReservationStatus",
    "200",
    1_048_576,
    "points.reservations.status",
  ],
  [
    "post",
    "/api/v1/settlements/{settlementId}/capture",
    "capturePointSettlement",
    "200",
    1_048_576,
    "points.reservations.capture",
  ],
  [
    "post",
    "/api/v1/point-reservations/release",
    "releasePointReservation",
    "200",
    1_048_576,
    "points.reservations.release",
  ],
];

const idempotentOperationIds = new Set([
  "checkPointPackageAuctionEligibility",
  "createPointsLinkAttempt",
  "finalizePointsLinkAttempt",
  "deactivatePointsConnection",
  "createPointReservation",
  "capturePointSettlement",
  "releasePointReservation",
]);

const userScopes = new Set([
  "openid",
  "profile",
  "offline_access",
  "points.connection.read",
  "points.balance.read",
  "points.reservations.create",
]);
const m2mScopes = new Set([
  "points.connection.link-attempt.create",
  "points.connection.link-attempt.finalize",
  "points.packages.auction-eligibility",
  "points.reservations.status",
  "points.reservations.capture",
  "points.reservations.release",
]);

function operation(operationId) {
  for (const methods of Object.values(document.paths)) {
    for (const candidate of Object.values(methods)) {
      if (candidate?.operationId === operationId) return candidate;
    }
  }
  assert.fail(`operation ${operationId} not found`);
}

function resolveSchema(schema) {
  if (!schema?.$ref) return schema;
  const name = schema.$ref.split("/").at(-1);
  return document.components.schemas[name];
}

function requestSchema(operationId) {
  return resolveSchema(
    operation(operationId).requestBody.content["application/json"].schema,
  );
}

function responseSchema(operationId, status) {
  return resolveSchema(
    operation(operationId).responses[status].content["application/json"].schema,
  );
}

function dataSchema(operationId, status) {
  return resolveSchema(responseSchema(operationId, status).properties.data);
}

function assertRequired(schema, expected) {
  assert.deepEqual(new Set(schema.required), new Set(expected));
  assert.equal(schema.additionalProperties, false);
}

function securityScopes(operationId) {
  return operation(operationId).security.flatMap((entry) =>
    Object.values(entry).flat(),
  );
}

function generatedSchema(name) {
  const marker = `    ${name}:`;
  const start = generatedContract.indexOf(marker);
  assert.notEqual(start, -1, `generated schema ${name} not found`);
  const remainder = generatedContract.slice(start + marker.length);
  const nextSchema = remainder.match(/\n    [A-Za-z][A-Za-z0-9]*:/);
  return remainder.slice(0, nextSchema?.index);
}

test("OpenAPI 3.1 document owns exactly the eleven Points operations", () => {
  assert.equal(document.openapi, "3.1.0");

  const actual = [];
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, candidate] of Object.entries(methods)) {
      if (candidate.operationId)
        actual.push([method, path, candidate.operationId]);
    }
  }

  assert.deepEqual(
    actual.sort((a, b) => a[2].localeCompare(b[2])),
    operations
      .map(([method, path, operationId]) => [method, path, operationId])
      .sort((a, b) => a[2].localeCompare(b[2])),
  );
  assert.equal(new Set(actual.map((item) => item[2])).size, 11);

  for (const standardPath of [
    "/api/auth/oauth2/authorize",
    "/api/auth/oauth2/token",
    "/api/auth/oauth2/introspect",
    "/api/auth/oauth2/revoke",
    "/api/auth/.well-known/openid-configuration",
  ]) {
    assert.equal(document.paths[standardPath], undefined);
  }
});

test("operation status, body byte limit, idempotency and private cache rules are exact", () => {
  for (const [
    method,
    path,
    operationId,
    successStatus,
    byteLimit,
  ] of operations) {
    const candidate = document.paths[path][method];
    assert.equal(candidate.operationId, operationId);
    assert.ok(candidate.responses[successStatus]);

    const successStatuses = Object.keys(candidate.responses).filter((status) =>
      ["200", "201", "202", "204", "304"].includes(status),
    );
    assert.deepEqual(
      new Set(successStatuses),
      new Set(
        operationId === "getPublicPointPackageRevision"
          ? ["200", "304"]
          : [successStatus],
      ),
    );

    if (byteLimit === null) {
      assert.equal(candidate["x-freeism-request-body-max-bytes"], undefined);
    } else {
      assert.equal(candidate["x-freeism-request-body-max-bytes"], byteLimit);
    }

    const header = candidate.parameters?.find(
      (parameter) =>
        parameter.in === "header" && parameter.name === "Idempotency-Key",
    );
    if (idempotentOperationIds.has(operationId)) {
      assert.equal(header?.required, true);
      assert.deepEqual(candidate["x-freeism-idempotency"], {
        replayHttpStatus: "preserve-initial",
        replayDomainResult: true,
        requestIdMayBeRegenerated: true,
        sameKeyDifferentPayloadStatus: 409,
        sameKeyDifferentPayloadCode: "IDEMPOTENCY_KEY_REUSED",
      });
    } else {
      assert.equal(header, undefined);
      assert.equal(candidate["x-freeism-idempotency"], undefined);
    }

    if (operationId !== "getPublicPointPackageRevision") {
      assert.equal(candidate["x-freeism-cache-control"], "private, no-store");
    }
  }
});

test("OAuth flows and opaque token classes stay separated", () => {
  const schemes = document.components.securitySchemes;
  assert.deepEqual(
    new Set(Object.keys(schemes)),
    new Set([
      "userOAuth",
      "connectionUnlinkOAuth",
      "settlementAdminOAuth",
      "m2mOAuth",
    ]),
  );
  assert.equal(
    schemes.userOAuth.flows.authorizationCode.tokenUrl,
    "https://points.freeism.app/api/auth/oauth2/token",
  );
  assert.equal(
    schemes.m2mOAuth.flows.clientCredentials.tokenUrl,
    "https://points.freeism.app/api/auth/oauth2/token",
  );
  assert.equal(
    schemes.userOAuth.flows.authorizationCode.refreshUrl,
    "https://points.freeism.app/api/auth/oauth2/token",
  );
  assert.equal(
    schemes.connectionUnlinkOAuth.flows.authorizationCode.refreshUrl,
    undefined,
  );
  assert.equal(
    schemes.settlementAdminOAuth.flows.authorizationCode.refreshUrl,
    undefined,
  );
  assert.deepEqual(
    new Set(Object.keys(schemes.userOAuth.flows.authorizationCode.scopes)),
    userScopes,
  );
  assert.deepEqual(
    new Set(Object.keys(schemes.m2mOAuth.flows.clientCredentials.scopes)),
    m2mScopes,
  );
  assert.deepEqual(
    new Set(
      Object.keys(schemes.connectionUnlinkOAuth.flows.authorizationCode.scopes),
    ),
    new Set(["points.connection.unlink"]),
  );
  assert.deepEqual(
    new Set(
      Object.keys(schemes.settlementAdminOAuth.flows.authorizationCode.scopes),
    ),
    new Set(["points.admin.settlement.retry"]),
  );

  assert.deepEqual(document["x-freeism-oauth-contract"], {
    issuer: "https://points.freeism.app/api/auth",
    introspectionEndpoint:
      "https://points.freeism.app/api/auth/oauth2/introspect",
    opaqueAccessTokens: true,
    disableJwtPlugin: true,
    accessTokenJwtDecodeForbidden: true,
    accessTokenJwksVerificationForbidden: true,
    idTokenAcceptedAsResourceBearer: false,
    userPrincipal:
      "active pairwise sub, client, audience/resource, scope, expiry and saved connection must match",
    m2mPrincipal:
      "active token without user sub and with only M2M scopes; client and owned resources must match",
    rejectCrossClientEnvironmentInactiveOrInsufficientScope: true,
  });

  for (const [, , operationId, , , scope] of operations) {
    const scopes = securityScopes(operationId);
    if (scope === null) {
      assert.deepEqual(operation(operationId).security, []);
    } else {
      assert.deepEqual(scopes, [scope]);
    }
    if (userScopes.has(scope) || scope === "points.connection.unlink") {
      assert.equal(
        scopes.some((item) => m2mScopes.has(item)),
        false,
      );
    }
    if (m2mScopes.has(scope)) {
      assert.equal(
        scopes.some((item) => userScopes.has(item)),
        false,
      );
    }
  }
});

test("public immutable revision schema, hash, ETag and cache contract are complete", () => {
  const candidate = operation("getPublicPointPackageRevision");
  const data = dataSchema("getPublicPointPackageRevision", "200");
  assertRequired(data, [
    "pointPackageId",
    "pointPackageRevisionId",
    "status",
    "name",
    "description",
    "relatedUrl",
    "totalWeight",
    "packageTick",
    "contentHash",
    "components",
  ]);
  assert.equal(data.properties.description.type.includes("null"), true);
  assert.equal(data.properties.relatedUrl.type.includes("null"), true);
  assert.deepEqual(data.properties.status.enum, ["ACTIVE", "INACTIVE"]);

  const component = resolveSchema(data.properties.components.items);
  assertRequired(component, [
    "evaluationCriterionId",
    "evaluationCriterionRevisionId",
    "name",
    "displayOrder",
    "weight",
    "minimumUnitScaled",
    "buyNowEnabled",
  ]);
  assert.equal(
    resolveSchema(component.properties.minimumUnitScaled).type,
    "string",
  );
  assert.equal(data.properties.components.minItems, 1);
  assert.equal(
    candidate["x-freeism-cache-control"],
    "public, max-age=31536000, immutable",
  );
  assert.equal(
    candidate.responses["200"].headers.ETag.schema.pattern,
    '^"sha256:[0-9a-f]{64}"$',
  );
  assert.ok(candidate.responses["304"]);
  assert.deepEqual(candidate["x-freeism-content-hash"], {
    algorithm: "SHA-256",
    encoding: "sha256:lowercase-hex",
    canonicalization: "RFC 8785 JSON Canonicalization Scheme over UTF-8",
    excludes: ["contentHash", "response-envelope"],
    componentSort: ["displayOrder:asc", "evaluationCriterionId:asc"],
    unknownFieldsIncluded: false,
  });
});

test("auction eligibility is atomic, bounded and returns a non-extending 30 second receipt", () => {
  const candidate = operation("checkPointPackageAuctionEligibility");
  const request = requestSchema("checkPointPackageAuctionEligibility");
  const response = dataSchema("checkPointPackageAuctionEligibility", "201");
  assertRequired(request, ["auctionCommandId", "auctionCommandHash", "items"]);
  assert.equal(request.properties.items.minItems, 1);
  assert.equal(request.properties.items.maxItems, 1000);
  assert.equal(
    request.properties.items["x-freeism-unique-by"],
    "auctionItemId",
  );
  assertRequired(response, [
    "pointPackageAuctionEligibilityReceiptId",
    "auctionCommandId",
    "auctionCommandHash",
    "items",
    "checkedAt",
    "validUntil",
  ]);
  assert.deepEqual(candidate["x-freeism-receipt"], {
    leaseSeconds: 30,
    validUntilExclusive: true,
    boundTo: [
      "clientId",
      "auctionCommandId",
      "auctionCommandHash",
      "allItems.auctionItemId",
      "allItems.pointPackageId",
      "allItems.pointPackageRevisionId",
      "allItems.contentHash",
    ],
    allOrNothing: true,
    failureReceiptCount: 0,
    idempotentReplayExtendsLease: false,
  });
  const problem = candidate.responses["409"].content[
    "application/problem+json"
  ].schema.oneOf
    .map(resolveSchema)
    .find(
      (variant) =>
        variant.properties.code.const === "POINT_PACKAGE_AUCTION_INELIGIBLE",
    );
  assert.deepEqual(
    problem.properties.code.const,
    "POINT_PACKAGE_AUCTION_INELIGIBLE",
  );
  const itemError = resolveSchema(problem.properties.errors.items);
  assertRequired(itemError, ["auctionItemId", "code"]);
  assert.equal(itemError.properties.code.enum.length, 6);
});

test("auction eligibility 409 distinguishes ineligibility from idempotency key reuse", () => {
  const response = operation("checkPointPackageAuctionEligibility").responses[
    "409"
  ];
  assert.equal(
    response.description,
    "Auction ineligibility or idempotency-key reuse conflict. No eligibility receipt is issued.",
  );
  const conflict = response.content["application/problem+json"].schema;
  assert.ok(conflict.oneOf, "eligibility 409 must be a oneOf");
  assert.equal(conflict.oneOf.length, 2);

  const variants = conflict.oneOf.map(resolveSchema);
  const ineligible = variants.find(
    (variant) =>
      variant.properties.code.const === "POINT_PACKAGE_AUCTION_INELIGIBLE",
  );
  const reused = variants.find(
    (variant) => variant.properties.code.const === "IDEMPOTENCY_KEY_REUSED",
  );

  assertRequired(ineligible, [
    "type",
    "title",
    "status",
    "code",
    "requestId",
    "errors",
  ]);
  assert.equal(ineligible.properties.status.const, 409);
  const itemError = resolveSchema(ineligible.properties.errors.items);
  assertRequired(itemError, ["auctionItemId", "code"]);

  assertRequired(reused, ["type", "title", "status", "code", "requestId"]);
  assert.equal(reused.properties.status.const, 409);
  assert.equal(reused.properties.errors, undefined);
});

test("link attempt, connection, balance and reservation wire schemas are exact", () => {
  assertRequired(requestSchema("createPointsLinkAttempt"), [
    "marketsUserId",
    "stateHash",
    "pkceChallenge",
    "redirectUri",
    "requestedScopes",
    "expiresAt",
    "returnUrlHash",
  ]);
  assert.equal(
    requestSchema("createPointsLinkAttempt").properties.pkceChallenge.pattern,
    "^[A-Za-z0-9_-]{43}$",
  );
  assert.deepEqual(
    operation("createPointsLinkAttempt")["x-freeism-link-attempt"],
    {
      maxTtlSeconds: 600,
      boundTo: [
        "clientId",
        "marketsUserId",
        "stateHash",
        "pkceChallenge",
        "redirectUri",
        "requestedScopes",
        "expiresAt",
        "returnUrlHash",
      ],
      opaqueAttemptId: true,
    },
  );

  assertRequired(requestSchema("finalizePointsLinkAttempt"), [
    "outcome",
    "marketsPointsConnectionId",
    "attemptPayloadHash",
  ]);
  assert.deepEqual(
    requestSchema("finalizePointsLinkAttempt").properties.outcome.enum,
    ["CONFIRM", "CANCEL"],
  );
  assert.deepEqual(
    operation("finalizePointsLinkAttempt")["x-freeism-link-finalization"],
    {
      tokenExchangeGrantStatus: "PENDING_MARKETS_CONFIRMATION",
      confirmGrantStatus: "ACTIVE",
      cancelGrantStatus: "CANCELLED",
      confirmAfterMarketsLocalPendingSave: true,
      cancelOrTtlRevokesOnlyNewAttemptGrant: true,
      sameOutcomeReturnsSameReceipt: true,
      oppositeOutcomeStatus: 409,
    },
  );

  assertRequired(dataSchema("getPointsConnection", "200"), [
    "pointsConnectionId",
    "issuer",
    "subject",
    "status",
    "grantedScopes",
    "grantVersion",
    "linkedAt",
  ]);
  assertRequired(requestSchema("deactivatePointsConnection"), [
    "pointsConnectionId",
    "reason",
    "deactivationKey",
  ]);
  assert.equal(
    requestSchema("deactivatePointsConnection").properties.deactivationKey[
      "x-freeism-must-equal-header"
    ],
    "Idempotency-Key",
  );
  assert.deepEqual(
    operation("deactivatePointsConnection")["x-freeism-unlink"],
    {
      googleFreshRequired: true,
      activeReservationCountMustEqual: 0,
      appOwnedGrantStatus: "UNLINKED",
      createsRevocationOutbox: true,
      marketsClosesAfterReceipt: true,
    },
  );

  assertRequired(requestSchema("checkPointBalance"), [
    "pointPackageRevisionId",
    "priceTicks",
    "quantity",
  ]);
  assertRequired(dataSchema("checkPointBalance", "200"), [
    "pointPackageRevisionId",
    "priceTicks",
    "quantity",
    "vectorHash",
    "components",
    "canReserve",
    "checkedAt",
  ]);

  assertRequired(requestSchema("createPointReservation"), [
    "reservationKey",
    "marketsUserId",
    "auctionId",
    "settlementId",
    "planHash",
    "pointPackageRevisionId",
    "priceTicks",
    "quantity",
    "leaseSeconds",
  ]);
  assert.equal(
    requestSchema("createPointReservation").properties.leaseSeconds.const,
    900,
  );
  assert.equal(
    operation("createPointReservation")["x-freeism-zero-vector-reservation"],
    true,
  );
});

test("status, capture and release schemas preserve ownership and state rules", () => {
  const statusRequest = requestSchema("getPointReservationStatus");
  assert.equal(statusRequest.oneOf.length, 2);
  assert.equal(statusRequest.discriminator, undefined);
  assert.match(
    generatedContract,
    /lookupBy: "POINT_RESERVATION_ID";[\s\S]*lookupBy: "RESERVATION_KEY";/,
  );
  assert.doesNotMatch(
    generatedContract,
    /lookupBy: "ReservationStatus(?:ById|ByKey)Request"/,
  );
  for (const variant of statusRequest.oneOf.map(resolveSchema)) {
    assert.equal(variant.additionalProperties, false);
    const arrayName = variant.required.find((name) => name !== "lookupBy");
    assert.equal(variant.properties[arrayName].minItems, 1);
    assert.equal(variant.properties[arrayName].uniqueItems, true);
    assert.equal(variant.properties[arrayName].maxItems, undefined);
  }
  assert.deepEqual(
    operation("getPointReservationStatus")["x-freeism-ownership"],
    {
      onlyCallingClientOwnedResources: true,
      unknownOrOtherClientStatus: 404,
      unknownOrOtherClientCode: "RESOURCE_NOT_FOUND",
    },
  );

  assertRequired(requestSchema("capturePointSettlement"), [
    "auctionId",
    "planHash",
    "reservations",
  ]);
  assert.equal(
    requestSchema("capturePointSettlement").properties.reservations[
      "x-freeism-unique-by"
    ],
    "pointReservationId",
  );
  assert.deepEqual(operation("capturePointSettlement")["x-freeism-atomicity"], {
    scope: "all-winner-reservations-in-request",
    partialSuccessAllowed: false,
    responseSort: "pointReservationId:asc",
    pathSettlementIdMustMatchRequestReservations: true,
  });
  const captureProblem = resolveSchema(
    operation("capturePointSettlement").responses["409"].content[
      "application/problem+json"
    ].schema,
  );
  assert.ok(captureProblem.oneOf);
  const genericCaptureConflict = resolveSchema(captureProblem.oneOf[1]);
  assert.equal(
    genericCaptureConflict.properties.code.enum.includes(
      "INSUFFICIENT_BALANCE",
    ),
    false,
  );

  assertRequired(requestSchema("releasePointReservation"), [
    "pointReservationId",
    "reason",
    "planHash",
  ]);
  assert.deepEqual(
    operation("releasePointReservation")["x-freeism-state-transition"],
    {
      from: "ACTIVE",
      to: "RELEASED",
      capturedReleaseAllowed: false,
      onlyCallingClientOwnedResource: true,
    },
  );
});

test("finalization and reservation status schemas preserve correlated unions in generated types", () => {
  const finalization = document.components.schemas.FinalizeLinkAttemptData;
  assert.ok(finalization.oneOf, "finalization data must be a oneOf");
  assert.equal(finalization.oneOf.length, 2);
  const finalizationVariants = finalization.oneOf.map(resolveSchema);
  for (const variant of finalizationVariants) {
    assertRequired(variant, [
      "linkAttemptFinalizationReceiptId",
      "linkAttemptId",
      "marketsPointsConnectionId",
      "outcome",
      "grantStatus",
      "finalizedAt",
    ]);
  }
  assert.deepEqual(
    finalizationVariants.map((variant) => [
      variant.properties.outcome.const,
      variant.properties.grantStatus.const,
    ]),
    [
      ["CONFIRM", "ACTIVE"],
      ["CANCEL", "CANCELLED"],
    ],
  );

  const generatedFinalization = generatedSchema("FinalizeLinkAttemptData");
  assert.match(
    generatedFinalization,
    /FinalizeLinkAttemptConfirmedData[\s\S]*FinalizeLinkAttemptCancelledData/,
  );
  assert.match(
    generatedSchema("FinalizeLinkAttemptConfirmedData"),
    /outcome: "CONFIRM";[\s\S]*grantStatus: "ACTIVE";/,
  );
  assert.match(
    generatedSchema("FinalizeLinkAttemptCancelledData"),
    /outcome: "CANCEL";[\s\S]*grantStatus: "CANCELLED";/,
  );

  const reservationStatus = document.components.schemas.ReservationStatusItem;
  assert.ok(reservationStatus.oneOf, "reservation status item must be a oneOf");
  assert.equal(reservationStatus.oneOf.length, 4);
  const reservationVariants = reservationStatus.oneOf.map(resolveSchema);
  for (const variant of reservationVariants) {
    assertRequired(variant, [
      "pointReservationId",
      "reservationKey",
      "status",
      "auctionId",
      "settlementId",
      "planHash",
      "vectorHash",
      "createdAt",
      "expiresAt",
      "terminalAt",
      "terminalReceiptId",
    ]);
  }
  assert.deepEqual(
    reservationVariants.map((variant) => variant.properties.status.const),
    ["ACTIVE", "CAPTURED", "RELEASED", "EXPIRED"],
  );

  const byStatus = Object.fromEntries(
    reservationVariants.map((variant) => [
      variant.properties.status.const,
      variant,
    ]),
  );
  assert.deepEqual(byStatus.ACTIVE.properties.terminalAt, { type: "null" });
  assert.deepEqual(byStatus.ACTIVE.properties.terminalReceiptId, {
    type: "null",
  });
  for (const status of ["CAPTURED", "RELEASED", "EXPIRED"]) {
    assert.equal(
      byStatus[status].properties.terminalAt.$ref,
      "#/components/schemas/UtcInstant",
    );
  }
  for (const status of ["CAPTURED", "RELEASED"]) {
    assert.equal(
      byStatus[status].properties.terminalReceiptId.$ref,
      "#/components/schemas/OpaqueId",
    );
  }
  assert.deepEqual(byStatus.EXPIRED.properties.terminalReceiptId.oneOf, [
    { $ref: "#/components/schemas/OpaqueId" },
    { type: "null" },
  ]);

  assert.match(
    generatedSchema("ReservationStatusItem"),
    /ActiveReservationStatusItem[\s\S]*CapturedReservationStatusItem[\s\S]*ReleasedReservationStatusItem[\s\S]*ExpiredReservationStatusItem/,
  );
  assert.match(
    generatedSchema("ActiveReservationStatusItem"),
    /status: "ACTIVE";[\s\S]*terminalAt: null;[\s\S]*terminalReceiptId: null;/,
  );
  assert.match(
    generatedSchema("CapturedReservationStatusItem"),
    /status: "CAPTURED";[\s\S]*terminalAt: components\["schemas"\]\["UtcInstant"\];[\s\S]*terminalReceiptId: components\["schemas"\]\["OpaqueId"\];/,
  );
  assert.match(
    generatedSchema("ReleasedReservationStatusItem"),
    /status: "RELEASED";[\s\S]*terminalAt: components\["schemas"\]\["UtcInstant"\];[\s\S]*terminalReceiptId: components\["schemas"\]\["OpaqueId"\];/,
  );
  assert.match(
    generatedSchema("ExpiredReservationStatusItem"),
    /status: "EXPIRED";[\s\S]*terminalAt: components\["schemas"\]\["UtcInstant"\];[\s\S]*terminalReceiptId: components\["schemas"\]\["OpaqueId"\] \| null;/,
  );
});

test("all operations expose the shared RFC 9457 rate limit response", () => {
  for (const [, , operationId] of operations) {
    assert.deepEqual(operation(operationId).responses["429"], {
      $ref: "#/components/responses/RateLimited",
    });
  }

  const response = document.components.responses.RateLimited;
  assert.equal(response.headers["Cache-Control"].required, true);
  assert.deepEqual(response.headers["Cache-Control"].schema, {
    type: "string",
    const: "private, no-store",
  });
  assert.equal(response.headers["Retry-After"].required, true);
  assert.equal(response.headers["Retry-After"].schema.type, "string");
  assert.equal(response.headers["Retry-After"].schema.minLength, 1);

  const problem = resolveSchema(
    response.content["application/problem+json"].schema,
  );
  assertRequired(problem, ["type", "title", "status", "code", "requestId"]);
  assert.equal(problem.properties.status.const, 429);
  assert.equal(problem.properties.code.const, "RATE_LIMITED");
});

test("capture balance conflicts always disclose the safe non-empty reservation ID set", () => {
  const captureProblem = resolveSchema(
    operation("capturePointSettlement").responses["409"].content[
      "application/problem+json"
    ].schema,
  );
  const genericCaptureConflict = resolveSchema(captureProblem.oneOf[1]);
  assert.equal(
    genericCaptureConflict.properties.code.enum.includes(
      "INSUFFICIENT_BALANCE",
    ),
    false,
  );
});

test("common schemas forbid extra properties, unsafe integers and floating point amounts", () => {
  const safeIntegerSchemas = [
    "PriceTicks",
    "PositiveSafeInteger",
    "NonNegativeSafeInteger",
  ];
  for (const name of safeIntegerSchemas) {
    const schema = document.components.schemas[name];
    assert.equal(schema.type, "integer");
    assert.equal(schema.maximum, 9_007_199_254_740_991);
  }
  assert.equal(document.components.schemas.PriceTicks.minimum, 0);
  assert.equal(document.components.schemas.PositiveSafeInteger.minimum, 1);
  assert.equal(document.components.schemas.NonNegativeSafeInteger.minimum, 0);
  assert.equal(document.components.schemas.SignedIntegerString.type, "string");
  assert.equal(
    document.components.schemas.NonNegativeIntegerString.type,
    "string",
  );

  const problem = document.components.schemas.ProblemDetails;
  assertRequired(problem, ["type", "title", "status", "code", "requestId"]);
  assert.equal(problem.properties.status.type, "integer");
  const validationError = document.components.schemas.ValidationError;
  assertRequired(validationError, ["code"]);

  for (const [name, schema] of Object.entries(document.components.schemas)) {
    if (schema.type === "object") {
      assert.equal(schema.additionalProperties, false, name);
    }
  }
});
