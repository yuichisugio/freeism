import { PointsApiError } from "../points/points-api-client";

export type ReservationFailureClass =
  | "INSUFFICIENT"
  | "REAUTH_REQUIRED"
  | "TEMPORARY"
  | "CONFLICT";

export interface ClassifiedReservationFailure {
  class: ReservationFailureClass;
  failureHash: string;
  requestId?: string;
  retryAfterMs?: number;
  safeCode: string;
}

function retryAfterMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function classifyReservationFailure(
  error: unknown,
  context: { planHash: string; reservationKey: string },
): Promise<ClassifiedReservationFailure> {
  let failureClass: ReservationFailureClass = "CONFLICT";
  let safeCode = "RESERVATION_CONFLICT";
  let status = 0;
  let requestId: string | undefined;
  let retryAfter: string | undefined;

  if (error instanceof PointsApiError) {
    status = error.status;
    safeCode = error.code;
    requestId = error.requestId;
    retryAfter = error.retryAfter;
    if (error.code === "INSUFFICIENT_BALANCE") failureClass = "INSUFFICIENT";
    else if (error.code === "INVALID_ACCESS_TOKEN" || error.status === 401) {
      failureClass = "REAUTH_REQUIRED";
    } else if ([429, 502, 503, 504].includes(error.status)) failureClass = "TEMPORARY";
  } else if (error instanceof DOMException && error.name === "AbortError") {
    failureClass = "TEMPORARY";
    safeCode = "RESERVATION_TIMEOUT";
  } else if (error instanceof TypeError) {
    failureClass = "TEMPORARY";
    safeCode = "RESERVATION_NETWORK_ERROR";
  } else if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
    failureClass = "REAUTH_REQUIRED";
    safeCode = "REAUTH_REQUIRED";
  } else if (
    error instanceof Error &&
    ["POINTS_INTROSPECTION_FAILED", "POINTS_TOKEN_REQUEST_FAILED", "POINTS_REFRESH_TIMEOUT"].includes(
      error.message,
    )
  ) {
    failureClass = "TEMPORARY";
    safeCode = error.message;
  }

  return {
    class: failureClass,
    failureHash: await sha256(
      JSON.stringify([safeCode, status, context.reservationKey, context.planHash]),
    ),
    requestId,
    retryAfterMs: retryAfterMs(retryAfter),
    safeCode,
  };
}
