import type { Context, Hono } from "hono";

import { pointsOAuthScopes } from "../../auth/points-oauth-provider";
import {
  introspectResourceRequest,
  type PointsOAuthPrincipal,
} from "../../auth/resource-token-introspection";
import { canonicalJson, sha256Hex } from "../../csv/csv-validation-result";
import type { operations } from "../../../generated/points-markets-api";
import { createPointsLinkAttempt } from "../../usecases/create-points-link-attempt";
import { finalizePointsLinkAttempt } from "../../usecases/finalize-points-link-attempt";
import { readPointsConnection } from "../../usecases/read-points-connection";
import type { BackendContext, Bindings } from "../context";
import { requireBindings } from "../context";
import { problem } from "../problem";

type CreateLinkBody =
  operations["createPointsLinkAttempt"]["requestBody"]["content"]["application/json"];
type FinalizeLinkBody =
  operations["finalizePointsLinkAttempt"]["requestBody"]["content"]["application/json"];

export type AuthorizePointsResource = (
  request: Request,
  env: Bindings,
  kind: "USER" | "M2M",
  scopes: readonly string[],
) => Promise<PointsOAuthPrincipal>;

const defaultAuthorize: AuthorizePointsResource = (request, env, kind, scopes) =>
  introspectResourceRequest(
    request,
    {
      allowedScopes: kind === "USER" ? pointsOAuthScopes.USER : pointsOAuthScopes.M2M,
      audience: `${env.APP_ORIGIN}/api/v1`,
      clientId:
        kind === "USER" ? env.MARKETS_USER_OAUTH_CLIENT_ID : env.MARKETS_M2M_OAUTH_CLIENT_ID,
      clientSecret:
        kind === "USER"
          ? env.MARKETS_USER_OAUTH_CLIENT_SECRET
          : env.MARKETS_M2M_OAUTH_CLIENT_SECRET,
      introspectionUrl: `${env.APP_ORIGIN}/api/auth/oauth2/introspect`,
      issuer: `${env.APP_ORIGIN}/api/auth`,
      kind,
    },
    scopes,
  );

async function readJson<T>(context: Context<BackendContext>) {
  const bytes = new Uint8Array(await context.req.arrayBuffer());
  if (bytes.byteLength > 64 * 1024) throw new Error("REQUEST_BODY_TOO_LARGE");
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new Error("MALFORMED_REQUEST");
  }
}

function idempotencyKey(context: Context<BackendContext>) {
  const value = context.req.header("Idempotency-Key")?.trim();
  if (!value) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return value;
}

function requestId(context: Context<BackendContext>) {
  return context.req.header("X-Request-Id")?.trim() || `req_${crypto.randomUUID()}`;
}

function mapError(context: Context<BackendContext>, error: unknown) {
  const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
  if (code === "REQUEST_BODY_TOO_LARGE")
    return problem(context, 413, code, "Request body too large");
  if (code === "INVALID_ACCESS_TOKEN") return problem(context, 401, code, "Invalid access token");
  if (code === "POINTS_CONNECTION_NOT_FOUND" || code === "LINK_ATTEMPT_NOT_FOUND") {
    return problem(context, 404, "RESOURCE_NOT_FOUND", "Resource not found");
  }
  if (code.includes("FINALIZED") || code.includes("MISMATCH") || code.includes("EXPIRED")) {
    return problem(context, 409, code, "OAuth link state conflict");
  }
  return problem(context, 422, code, "Invalid OAuth link request");
}

export function registerOAuthResourceRoutes(
  app: Hono<BackendContext>,
  authorize: AuthorizePointsResource = defaultAuthorize,
) {
  app.post("/api/v1/oauth/link-attempts", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.connection.link-attempt.create",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson<CreateLinkBody>(context);
      const payloadHash = `sha256:${await sha256Hex(
        canonicalJson({ body, clientId: principal.clientId }),
      )}`;
      const attempt = await createPointsLinkAttempt(env.DB, {
        expiresAt: new Date(body.expiresAt),
        idempotencyKey: idempotencyKey(context),
        marketsUserId: body.marketsUserId,
        m2mClientId: principal.clientId,
        payloadHash,
        requestedScopes: body.requestedScopes,
        stateHash: body.stateHash,
        userClientId: env.MARKETS_USER_OAUTH_CLIENT_ID,
      });
      return context.json(
        {
          data: {
            expiresAt: attempt.expiresAt.toISOString(),
            linkAttemptId: attempt.linkAttemptId,
          },
          meta: { requestId: requestId(context) },
        },
        201,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.post("/api/v1/oauth/link-attempts/:linkAttemptId/finalizations", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "M2M", [
        "points.connection.link-attempt.finalize",
      ]);
      if (principal.kind !== "M2M") throw new Error("INVALID_ACCESS_TOKEN");
      const body = await readJson<FinalizeLinkBody>(context);
      const finalized = await finalizePointsLinkAttempt(env.DB, {
        attemptPayloadHash: body.attemptPayloadHash,
        idempotencyKey: idempotencyKey(context),
        issuer: body.outcome === "CONFIRM" ? body.pointsIssuer : undefined,
        linkAttemptId: context.req.param("linkAttemptId"),
        marketsPointsConnectionId: body.marketsPointsConnectionId,
        m2mClientId: principal.clientId,
        outcome: body.outcome,
        pointsSubject: body.outcome === "CONFIRM" ? body.pointsSubject : undefined,
        userClientId: body.outcome === "CONFIRM" ? body.userClientId : undefined,
      });
      const finalizedAt =
        finalized.status === "CANCELLED" ? finalized.finalizedAt : finalized.linkedAt;
      return context.json(
        {
          data: {
            finalizedAt: finalizedAt.toISOString(),
            grantStatus: finalized.status === "CANCELLED" ? "CANCELLED" : "ACTIVE",
            linkAttemptFinalizationReceiptId: `plf_${context.req.param("linkAttemptId")}`,
            linkAttemptId: context.req.param("linkAttemptId"),
            marketsPointsConnectionId: finalized.marketsPointsConnectionId,
            outcome: finalized.status === "CANCELLED" ? "CANCEL" : "CONFIRM",
          },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });

  app.get("/api/v1/me/connection", async (context) => {
    try {
      const env = requireBindings(context.env);
      const principal = await authorize(context.req.raw, env, "USER", ["points.connection.read"]);
      if (principal.kind !== "USER") throw new Error("INVALID_ACCESS_TOKEN");
      const connection = await readPointsConnection(env.DB, {
        issuer: principal.issuer,
        pointsSubject: principal.subject,
        userClientId: principal.clientId,
      });
      return context.json(
        {
          data: { ...connection, linkedAt: connection.linkedAt.toISOString() },
          meta: { requestId: requestId(context) },
        },
        200,
        { "Cache-Control": "private, no-store" },
      );
    } catch (error) {
      return mapError(context, error);
    }
  });
}
