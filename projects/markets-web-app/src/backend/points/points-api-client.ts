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

export class PointsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const problem: { code?: string } = await response
      .clone()
      .json<{ code?: string }>()
      .catch(() => ({}) as { code?: string });
    throw new PointsApiError(response.status, problem.code ?? "POINTS_API_ERROR");
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
  ) {
    return json<components["schemas"]["CreateReservationResponse"]>(
      await this.service.fetch(
        request("/api/v1/me/point-reservations", {
          bearer: userAccessToken,
          body,
          idempotencyKey,
        }),
      ),
    );
  }

  async getPointReservationStatus(body: StatusBody) {
    const bearer = await this.getM2MAccessToken(["points.reservations.status"]);
    return json<components["schemas"]["ReservationStatusResponse"]>(
      await this.service.fetch(request("/api/v1/point-reservations/status", { bearer, body })),
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

  async releasePointReservation(body: ReleaseBody, idempotencyKey: string) {
    const bearer = await this.getM2MAccessToken(["points.reservations.release"]);
    return json<components["schemas"]["ReleaseReservationResponse"]>(
      await this.service.fetch(
        request("/api/v1/point-reservations/release", { bearer, body, idempotencyKey }),
      ),
    );
  }
}
