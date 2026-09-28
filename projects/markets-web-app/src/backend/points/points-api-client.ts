import * as v from "valibot";

import {
  auctionEligibilityItemErrorSchema,
  auctionEligibilityRequestSchema,
  auctionEligibilityResponseSchema,
  balanceCheckRequestSchema,
  balanceCheckResponseSchema,
  captureSettlementRequestSchema,
  captureSettlementResponseSchema,
  createLinkAttemptRequestSchema,
  createLinkAttemptResponseSchema,
  createReservationRequestSchema,
  createReservationResponseSchema,
  deactivateConnectionRequestSchema,
  deactivateConnectionResponseSchema,
  finalizeLinkAttemptRequestSchema,
  finalizeLinkAttemptResponseSchema,
  pointsConnectionResponseSchema,
  releaseReservationRequestSchema,
  releaseReservationResponseSchema,
  reservationStatusRequestSchema,
  reservationStatusResponseSchema,
  type AuctionEligibilityItemError,
  type AuctionEligibilityRequest,
  type BalanceCheckRequest,
  type CaptureSettlementRequest,
  type CreateLinkAttemptRequest,
  type CreateReservationRequest,
  type DeactivateConnectionRequest,
  type FinalizeLinkAttemptRequest,
  type ReleaseReservationRequest,
  type ReservationStatusRequest,
} from "./points-api-schemas";

function isAuctionEligibilityItemError(value: unknown): value is AuctionEligibilityItemError {
  return v.safeParse(auctionEligibilityItemErrorSchema, value).success;
}

function readProblem(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return {
      code: "POINTS_API_ERROR",
      errors: [],
      insufficientReservationIds: undefined,
      requestId: undefined,
    };
  }
  const problem = value as {
    code?: unknown;
    errors?: unknown;
    insufficientReservationIds?: unknown;
    requestId?: unknown;
  };
  const code = typeof problem.code === "string" ? problem.code : "POINTS_API_ERROR";
  const errors =
    code === "POINT_PACKAGE_AUCTION_INELIGIBLE" &&
    Array.isArray(problem.errors) &&
    problem.errors.every(isAuctionEligibilityItemError)
      ? problem.errors
      : [];
  return {
    code,
    errors,
    insufficientReservationIds:
      code === "INSUFFICIENT_BALANCE" && Array.isArray(problem.insufficientReservationIds)
        ? problem.insufficientReservationIds
        : undefined,
    requestId: typeof problem.requestId === "string" ? problem.requestId : undefined,
  };
}

export interface PointsRequestOptions {
  signal?: AbortSignal;
}

export class PointsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly errors: readonly AuctionEligibilityItemError[] = [],
    readonly requestId?: string,
    readonly retryAfter?: string,
    readonly insufficientReservationIds?: readonly unknown[],
  ) {
    super(code);
  }
}

async function json<T extends v.GenericSchema>(
  response: Response,
  schema: T,
): Promise<v.InferOutput<T>> {
  if (!response.ok) {
    const body: unknown = await response.json<unknown>().catch(() => undefined);
    const problem = readProblem(body);
    throw new PointsApiError(
      response.status,
      problem.code,
      problem.errors,
      problem.requestId,
      response.headers.get("Retry-After") ?? undefined,
      problem.insufficientReservationIds,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PointsApiError(response.status, "POINTS_API_RESPONSE_INVALID");
  }
  const parsed = v.safeParse(schema, body);
  if (!parsed.success) {
    throw new PointsApiError(response.status, "POINTS_API_RESPONSE_INVALID");
  }
  return parsed.output;
}

function request(
  path: string,
  input: {
    bearer?: string;
    body?: unknown;
    idempotencyKey?: string;
    ifNoneMatch?: string;
    method?: "GET" | "POST";
    signal?: AbortSignal;
  },
) {
  const headers = new Headers({ Accept: "application/json" });
  if (input.bearer) headers.set("Authorization", `Bearer ${input.bearer}`);
  if (input.body !== undefined) headers.set("Content-Type", "application/json");
  if (input.idempotencyKey) headers.set("Idempotency-Key", input.idempotencyKey);
  if (input.ifNoneMatch) headers.set("If-None-Match", input.ifNoneMatch);
  return new Request(`https://points.service${path}`, {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers,
    method: input.method ?? (input.body === undefined ? "GET" : "POST"),
    signal: input.signal,
  });
}

export class PointsApiClient {
  constructor(
    private readonly service: Fetcher,
    private readonly getM2MAccessToken: (scopes: readonly string[]) => Promise<string>,
  ) {}

  async getPublicPointPackageRevision(pointPackageRevisionId: string, ifNoneMatch?: string) {
    return this.service.fetch(
      request(
        `/api/v1/point-package-revisions/${encodeURIComponent(pointPackageRevisionId)}`,
        ifNoneMatch ? { ifNoneMatch } : {},
      ),
    );
  }

  async checkPointPackageAuctionEligibility(
    body: AuctionEligibilityRequest,
    idempotencyKey: string,
  ) {
    const bearer = await this.getM2MAccessToken(["points.packages.auction-eligibility"]);
    return json(
      await this.service.fetch(
        request("/api/v1/point-package-auction-eligibility-checks", {
          bearer,
          body: v.parse(auctionEligibilityRequestSchema, body),
          idempotencyKey,
        }),
      ),
      auctionEligibilityResponseSchema,
    );
  }

  async createPointsLinkAttempt(body: CreateLinkAttemptRequest, idempotencyKey: string) {
    const bearer = await this.getM2MAccessToken(["points.connection.link-attempt.create"]);
    return json(
      await this.service.fetch(
        request("/api/v1/oauth/link-attempts", {
          bearer,
          body: v.parse(createLinkAttemptRequestSchema, body),
          idempotencyKey,
        }),
      ),
      createLinkAttemptResponseSchema,
    );
  }

  async finalizePointsLinkAttempt(
    linkAttemptId: string,
    body: FinalizeLinkAttemptRequest,
    idempotencyKey: string,
  ) {
    const bearer = await this.getM2MAccessToken(["points.connection.link-attempt.finalize"]);
    return json(
      await this.service.fetch(
        request(`/api/v1/oauth/link-attempts/${encodeURIComponent(linkAttemptId)}/finalizations`, {
          bearer,
          body: v.parse(finalizeLinkAttemptRequestSchema, body),
          idempotencyKey,
        }),
      ),
      finalizeLinkAttemptResponseSchema,
    );
  }

  async getPointsConnection(userAccessToken: string) {
    return json(
      await this.service.fetch(request("/api/v1/me/connection", { bearer: userAccessToken })),
      pointsConnectionResponseSchema,
    );
  }

  async deactivatePointsConnection(
    body: DeactivateConnectionRequest,
    idempotencyKey: string,
    userAccessToken: string,
  ) {
    return json(
      await this.service.fetch(
        request("/api/v1/me/connection-deactivations", {
          bearer: userAccessToken,
          body: v.parse(deactivateConnectionRequestSchema, body),
          idempotencyKey,
        }),
      ),
      deactivateConnectionResponseSchema,
    );
  }

  async checkPointBalance(body: BalanceCheckRequest, userAccessToken: string) {
    return json(
      await this.service.fetch(
        request("/api/v1/me/balance-checks", {
          bearer: userAccessToken,
          body: v.parse(balanceCheckRequestSchema, body),
        }),
      ),
      balanceCheckResponseSchema,
    );
  }

  async createPointReservation(
    body: CreateReservationRequest,
    idempotencyKey: string,
    userAccessToken: string,
    options: PointsRequestOptions = {},
  ) {
    return json(
      await this.service.fetch(
        request("/api/v1/me/point-reservations", {
          bearer: userAccessToken,
          body: v.parse(createReservationRequestSchema, body),
          idempotencyKey,
          signal: options.signal,
        }),
      ),
      createReservationResponseSchema,
    );
  }

  async getPointReservationStatus(
    body: ReservationStatusRequest,
    options: PointsRequestOptions = {},
  ) {
    const bearer = await this.getM2MAccessToken(["points.reservations.status"]);
    return json(
      await this.service.fetch(
        request("/api/v1/point-reservations/status", {
          bearer,
          body: v.parse(reservationStatusRequestSchema, body),
          signal: options.signal,
        }),
      ),
      reservationStatusResponseSchema,
    );
  }

  async capturePointSettlement(
    settlementId: string,
    body: CaptureSettlementRequest,
    idempotencyKey: string,
    options: PointsRequestOptions = {},
  ) {
    const bearer = await this.getM2MAccessToken(["points.reservations.capture"]);
    return json(
      await this.service.fetch(
        request(`/api/v1/settlements/${encodeURIComponent(settlementId)}/capture`, {
          bearer,
          body: v.parse(captureSettlementRequestSchema, body),
          idempotencyKey,
          signal: options.signal,
        }),
      ),
      captureSettlementResponseSchema,
    );
  }

  async releasePointReservation(
    body: ReleaseReservationRequest,
    idempotencyKey: string,
    options: PointsRequestOptions = {},
  ) {
    const bearer = await this.getM2MAccessToken(["points.reservations.release"]);
    return json(
      await this.service.fetch(
        request("/api/v1/point-reservations/release", {
          bearer,
          body: v.parse(releaseReservationRequestSchema, body),
          idempotencyKey,
          signal: options.signal,
        }),
      ),
      releaseReservationResponseSchema,
    );
  }
}
