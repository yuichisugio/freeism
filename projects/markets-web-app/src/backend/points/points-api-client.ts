import type { components, operations } from "../../generated/points-markets-api";

type EligibilityBody =
  operations["checkPointPackageAuctionEligibility"]["requestBody"]["content"]["application/json"];
type CreateLinkBody =
  operations["createPointsLinkAttempt"]["requestBody"]["content"]["application/json"];
type FinalizeLinkBody =
  operations["finalizePointsLinkAttempt"]["requestBody"]["content"]["application/json"];
type DeactivateBody =
  operations["deactivatePointsConnection"]["requestBody"]["content"]["application/json"];
type BalanceBody = operations["checkPointBalance"]["requestBody"]["content"]["application/json"];
type ReservationBody =
  operations["createPointReservation"]["requestBody"]["content"]["application/json"];
type StatusBody =
  operations["getPointReservationStatus"]["requestBody"]["content"]["application/json"];
type CaptureBody =
  operations["capturePointSettlement"]["requestBody"]["content"]["application/json"];
type ReleaseBody =
  operations["releasePointReservation"]["requestBody"]["content"]["application/json"];
type AuctionEligibilityItemError = components["schemas"]["AuctionEligibilityItemError"];

const AUCTION_ELIGIBILITY_ERROR_CODES = [
  "POINT_PACKAGE_NOT_FOUND",
  "POINT_PACKAGE_REVISION_NOT_FOUND",
  "POINT_PACKAGE_REVISION_MISMATCH",
  "POINT_PACKAGE_REVISION_INACTIVE",
  "POINT_PACKAGE_INACTIVE",
  "CONTENT_HASH_MISMATCH",
] as const;

function isAuctionEligibilityItemError(value: unknown): value is AuctionEligibilityItemError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { auctionItemId?: unknown; code?: unknown };
  return (
    typeof candidate.auctionItemId === "string" &&
    typeof candidate.code === "string" &&
    AUCTION_ELIGIBILITY_ERROR_CODES.some((code) => code === candidate.code)
  );
}

function readProblem(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return { code: "POINTS_API_ERROR", errors: [], requestId: undefined };
  }
  const problem = value as { code?: unknown; errors?: unknown; requestId?: unknown };
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
  ) {
    super(code);
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response.json<unknown>().catch(() => undefined);
    const problem = readProblem(body);
    throw new PointsApiError(
      response.status,
      problem.code,
      problem.errors,
      problem.requestId,
      response.headers.get("Retry-After") ?? undefined,
    );
  }
  return response.json<T>();
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

  async checkPointPackageAuctionEligibility(body: EligibilityBody, idempotencyKey: string) {
    const bearer = await this.getM2MAccessToken(["points.packages.auction-eligibility"]);
    return json<components["schemas"]["AuctionEligibilityResponse"]>(
      await this.service.fetch(
        request("/api/v1/point-package-auction-eligibility-checks", {
          bearer,
          body,
          idempotencyKey,
        }),
      ),
    );
  }

  async createPointsLinkAttempt(body: CreateLinkBody, idempotencyKey: string) {
    const bearer = await this.getM2MAccessToken(["points.connection.link-attempt.create"]);
    return json<components["schemas"]["CreateLinkAttemptResponse"]>(
      await this.service.fetch(
        request("/api/v1/oauth/link-attempts", { bearer, body, idempotencyKey }),
      ),
    );
  }

  async finalizePointsLinkAttempt(
    linkAttemptId: string,
    body: FinalizeLinkBody,
    idempotencyKey: string,
  ) {
    const bearer = await this.getM2MAccessToken(["points.connection.link-attempt.finalize"]);
    return json<components["schemas"]["FinalizeLinkAttemptResponse"]>(
      await this.service.fetch(
        request(`/api/v1/oauth/link-attempts/${encodeURIComponent(linkAttemptId)}/finalizations`, {
          bearer,
          body,
          idempotencyKey,
        }),
      ),
    );
  }

  async getPointsConnection(userAccessToken: string) {
    return json<components["schemas"]["PointsConnectionResponse"]>(
      await this.service.fetch(request("/api/v1/me/connection", { bearer: userAccessToken })),
    );
  }

  async deactivatePointsConnection(
    body: DeactivateBody,
    idempotencyKey: string,
    userAccessToken: string,
  ) {
    return json<components["schemas"]["DeactivateConnectionResponse"]>(
      await this.service.fetch(
        request("/api/v1/me/connection-deactivations", {
          bearer: userAccessToken,
          body,
          idempotencyKey,
        }),
      ),
    );
  }

  async checkPointBalance(body: BalanceBody, userAccessToken: string) {
    return json<components["schemas"]["BalanceCheckResponse"]>(
      await this.service.fetch(
        request("/api/v1/me/balance-checks", { bearer: userAccessToken, body }),
      ),
    );
  }

  async createPointReservation(
    body: ReservationBody,
    idempotencyKey: string,
    userAccessToken: string,
    options: PointsRequestOptions = {},
  ) {
    return json<components["schemas"]["CreateReservationResponse"]>(
      await this.service.fetch(
        request("/api/v1/me/point-reservations", {
          bearer: userAccessToken,
          body,
          idempotencyKey,
          signal: options.signal,
        }),
      ),
    );
  }

  async getPointReservationStatus(body: StatusBody, options: PointsRequestOptions = {}) {
    const bearer = await this.getM2MAccessToken(["points.reservations.status"]);
    return json<components["schemas"]["ReservationStatusResponse"]>(
      await this.service.fetch(
        request("/api/v1/point-reservations/status", { bearer, body, signal: options.signal }),
      ),
    );
  }

  async capturePointSettlement(settlementId: string, body: CaptureBody, idempotencyKey: string) {
    const bearer = await this.getM2MAccessToken(["points.reservations.capture"]);
    return json<components["schemas"]["CaptureSettlementResponse"]>(
      await this.service.fetch(
        request(`/api/v1/settlements/${encodeURIComponent(settlementId)}/capture`, {
          bearer,
          body,
          idempotencyKey,
        }),
      ),
    );
  }

  async releasePointReservation(
    body: ReleaseBody,
    idempotencyKey: string,
    options: PointsRequestOptions = {},
  ) {
    const bearer = await this.getM2MAccessToken(["points.reservations.release"]);
    return json<components["schemas"]["ReleaseReservationResponse"]>(
      await this.service.fetch(
        request("/api/v1/point-reservations/release", {
          bearer,
          body,
          idempotencyKey,
          signal: options.signal,
        }),
      ),
    );
  }
}
