import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { Hono } from "hono";

import type { AuctionImportPreview } from "../../src/backend/auction/import/validate-auction-import";
import type { BackendContext } from "../../src/backend/http/context";
import { registerAuctionImportRoutes } from "../../src/backend/http/routes/auction-import-routes";

const authUserId = `auth-import-${crypto.randomUUID()}`;
const marketsUserId = `musr_import_${crypto.randomUUID()}`;
const origin = "https://markets.example.test";
const csv = "clientRowId,title\nrow-1,title";

const preview: AuctionImportPreview = {
  auctionCommandHash: `sha256:${"a".repeat(64)}`,
  auctionCommandId: "acmd_preview",
  fileHash: `sha256:${"b".repeat(64)}`,
  rows: [],
};

beforeAll(async () => {
  await env.DB!.batch([
    env
      .DB!.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
      .bind(authUserId, "Import user", `${authUserId}@example.test`),
    env
      .DB!.prepare("INSERT INTO markets_user (id, auth_user_id) VALUES (?, ?)")
      .bind(marketsUserId, authUserId),
    env
      .DB!.prepare(
        "INSERT INTO account (id, account_id, provider_id, user_id, updated_at) VALUES (?, ?, 'google', ?, 1)",
      )
      .bind(`account-${authUserId}`, `google-${authUserId}`, authUserId),
  ]);
});

function app(validate = vi.fn(async () => preview)) {
  const hono = new Hono<BackendContext>();
  registerAuctionImportRoutes(
    hono,
    async () => ({
      session: { id: "session-import", userId: authUserId },
      user: { id: authUserId },
    }),
    validate,
  );
  return { hono, validate };
}

function request(options: { body?: string; contentType?: string; contentLength?: string } = {}) {
  return new Request(`${origin}/api/auctions/import/validate`, {
    body: options.body ?? csv,
    headers: {
      "Content-Type": options.contentType ?? "text/csv; charset=utf-8",
      "Idempotency-Key": "preview-key-1",
      Origin: origin,
      ...(options.contentLength ? { "Content-Length": options.contentLength } : {}),
    },
    method: "POST",
  });
}

describe("Auction import preview route", () => {
  it("authenticates, passes raw bytes to validation and responds no-store", async () => {
    const { hono, validate } = app();

    const response = await hono.fetch(request(), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ data: preview });
    expect(validate).toHaveBeenCalledWith({
      bytes: expect.any(Uint8Array),
      idempotencyKey: "preview-key-1",
    });
  });

  it("rejects unsupported content types and bodies over 5 MiB before validation", async () => {
    const unsupported = app();
    const unsupportedResponse = await unsupported.hono.fetch(
      request({ contentType: "application/json" }),
      env,
    );
    expect(unsupportedResponse.status).toBe(415);
    expect(unsupported.validate).not.toHaveBeenCalled();

    const tooLarge = app();
    const tooLargeResponse = await tooLarge.hono.fetch(
      request({ contentLength: String(5 * 1024 * 1024 + 1) }),
      env,
    );
    expect(tooLargeResponse.status).toBe(413);
    expect(tooLarge.validate).not.toHaveBeenCalled();
  });

  it("requires an idempotency key and returns structured row errors", async () => {
    const missingKey = app();
    const missingResponse = await missingKey.hono.fetch(
      new Request(`${origin}/api/auctions/import/validate`, {
        body: csv,
        headers: { "Content-Type": "text/csv", Origin: origin },
        method: "POST",
      }),
      env,
    );
    expect(missingResponse.status).toBe(400);

    const invalid = app(
      vi.fn(async () => {
        const error = new Error("AUCTION_IMPORT_VALIDATION_FAILED");
        Object.assign(error, {
          code: "AUCTION_IMPORT_VALIDATION_FAILED",
          errors: [{ code: "AUCTION_FIELD_REQUIRED", field: "pointPackageId", row: 2 }],
        });
        throw error;
      }),
    );
    const invalidResponse = await invalid.hono.fetch(request(), env);
    expect(invalidResponse.status).toBe(422);
    expect(invalidResponse.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(invalidResponse.json()).resolves.toMatchObject({
      code: "VALIDATION_FAILED",
      errors: [{ code: "AUCTION_FIELD_REQUIRED", field: "pointPackageId", row: 2 }],
    });
  });

  it("returns a Points idempotency-key reuse as a 409 Problem Details response", async () => {
    const conflict = app(
      vi.fn(async () => {
        const error = new Error("IDEMPOTENCY_KEY_REUSED");
        Object.assign(error, { code: "IDEMPOTENCY_KEY_REUSED" });
        throw error;
      }),
    );

    const response = await conflict.hono.fetch(request(), env);

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      status: 409,
    });
  });
});
