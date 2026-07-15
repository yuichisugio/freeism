import { createMiddleware } from "hono/factory";

import { requireMarketsSession, type GetSession } from "../../auth/require-markets-session";
import { D1IdempotencyRepository } from "../../db/d1-idempotency-repository";
import type { BackendContext } from "../context";
import { problemDetails } from "../problem-details";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("MALFORMED_REQUEST");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("MALFORMED_REQUEST");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createIdempotencyMiddleware(getSession: GetSession, operation: string) {
  return createMiddleware<BackendContext>(async (context, next) => {
    const idempotencyKey = context.req.header("Idempotency-Key")?.trim();
    const browserMutation = context.req.header("Origin") !== undefined;

    // Existing server-side calls have no browser Origin. Browser mutations always use the boundary.
    if (!idempotencyKey && !browserMutation) return next();
    if (!idempotencyKey) {
      return problemDetails(context, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key required");
    }
    if (idempotencyKey.length > 200) {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Idempotency-Key is too long");
    }

    let payloadHash: string;
    try {
      const payload = await context.req.raw.clone().json<unknown>();
      payloadHash = await sha256Hex(canonicalJson(payload));
    } catch {
      return problemDetails(context, 400, "MALFORMED_REQUEST", "Malformed JSON request");
    }

    const actor = await requireMarketsSession(context, getSession);
    if (!actor) {
      return problemDetails(context, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }
    const repository = new D1IdempotencyRepository(context.env.DB);
    const reservation = await repository.replayOrReserve(
      actor.marketsUserId,
      operation,
      idempotencyKey,
      payloadHash,
    );
    if (reservation.kind === "CONFLICT") {
      return problemDetails(
        context,
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency-Key reused with another payload",
      );
    }
    if (reservation.kind === "IN_PROGRESS") {
      return problemDetails(
        context,
        409,
        "IDEMPOTENCY_REQUEST_IN_PROGRESS",
        "Idempotent request is in progress",
      );
    }
    if (reservation.kind === "REPLAY") {
      return new Response(reservation.result.responseBody, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": reservation.result.contentType,
        },
        status: reservation.result.status,
      });
    }

    await next();
    const response = context.res;
    await repository.complete(reservation.reservationId, {
      contentType: response.headers.get("Content-Type") ?? "application/json; charset=UTF-8",
      responseBody: await response.clone().text(),
      status: response.status,
    });
  });
}
