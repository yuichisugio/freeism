import { describe, expect, it } from "vite-plus/test";

import { createCsvExportCursor, verifyCsvExportCursor } from "./csv-export-cursor";

const secret = "test-only-csv-export-cursor-secret";
const createdAt = "2026-07-13T00:00:00.000Z";
const snapshotAt = "2026-07-12T23:59:59.000Z";

const binding = {
  exportId: "export-1",
  filterHash: "filter-hash-1",
  snapshotAt,
};

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function signPayload(payload: object): Promise<string> {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64Url(new Uint8Array(signature))}`;
}

async function createCursor(): Promise<string> {
  return createCsvExportCursor({
    ...binding,
    nextOrdinal: 1_000,
    now: createdAt,
    secret,
  });
}

describe("CSV export cursor", () => {
  it("binds a signed opaque token to the export, filter, snapshot and next ordinal", async () => {
    const cursor = await createCursor();

    expect(cursor).not.toContain(secret);
    await expect(
      verifyCsvExportCursor({
        ...binding,
        cursor,
        now: "2026-07-13T00:29:59.999Z",
        secret,
      }),
    ).resolves.toEqual({
      nextOrdinal: 1_000,
      expiresAt: "2026-07-13T00:30:00.000Z",
    });
  });

  it("rejects a modified token without disclosing the secret", async () => {
    const cursor = await createCursor();
    const [payload, signature] = cursor.split(".");
    const modified = `${payload?.startsWith("a") ? "b" : "a"}${payload?.slice(1)}.${signature}`;

    await expect(
      verifyCsvExportCursor({ ...binding, cursor: modified, now: createdAt, secret }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_INVALID");
    await expect(
      verifyCsvExportCursor({ ...binding, cursor: modified, now: createdAt, secret }),
    ).rejects.not.toThrow(secret);
  });

  it.each([
    [{ exportId: "export-2" }, "another export"],
    [{ filterHash: "filter-hash-2" }, "another filter"],
    [{ snapshotAt: "2026-07-12T23:59:58.000Z" }, "another snapshot"],
  ])("rejects a cursor used with %s (%s)", async (differentBinding, _description) => {
    const cursor = await createCursor();

    await expect(
      verifyCsvExportCursor({
        ...binding,
        ...differentBinding,
        cursor,
        now: createdAt,
        secret,
      }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_INVALID");
  });

  it("rejects a cryptographically valid negative next ordinal", async () => {
    const cursor = await signPayload({
      version: 1,
      ...binding,
      nextOrdinal: -1,
      expiresAt: "2026-07-13T00:30:00.000Z",
    });

    await expect(
      verifyCsvExportCursor({ ...binding, cursor, now: createdAt, secret }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_INVALID");
  });

  it("rejects a negative next ordinal at creation", async () => {
    await expect(
      createCsvExportCursor({
        ...binding,
        nextOrdinal: -1,
        now: createdAt,
        secret,
      }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_INVALID");
  });

  it("expires exactly 30 minutes after creation and does not extend on reads", async () => {
    const cursor = await createCursor();

    await expect(
      verifyCsvExportCursor({
        ...binding,
        cursor,
        now: "2026-07-13T00:30:00.000Z",
        secret,
      }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_EXPIRED");
  });

  it("preserves the snapshot expiry when creating a cursor for a later page", async () => {
    const firstCursor = await createCursor();
    const firstPage = await verifyCsvExportCursor({
      ...binding,
      cursor: firstCursor,
      now: "2026-07-13T00:10:00.000Z",
      secret,
    });
    const nextCursor = await createCsvExportCursor({
      ...binding,
      nextOrdinal: 2_000,
      now: "2026-07-13T00:10:00.000Z",
      expiresAt: firstPage.expiresAt,
      secret,
    });

    await expect(
      verifyCsvExportCursor({
        ...binding,
        cursor: nextCursor,
        now: "2026-07-13T00:30:00.000Z",
        secret,
      }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_EXPIRED");
  });

  it("rejects an inherited expiry that would extend the 30 minute lifetime", async () => {
    await expect(
      createCsvExportCursor({
        ...binding,
        nextOrdinal: 2_000,
        now: "2026-07-13T00:10:00.000Z",
        expiresAt: "2026-07-13T00:40:00.001Z",
        secret,
      }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_INVALID");
  });

  it("allows the same valid cursor to read the same page again", async () => {
    const cursor = await createCursor();
    const input = {
      ...binding,
      cursor,
      now: "2026-07-13T00:10:00.000Z",
      secret,
    };

    const first = await verifyCsvExportCursor(input);
    const second = await verifyCsvExportCursor(input);

    expect(second).toEqual(first);
  });

  it("rejects an unsupported signed payload version", async () => {
    const cursor = await signPayload({
      version: 2,
      ...binding,
      nextOrdinal: 1_000,
      expiresAt: "2026-07-13T00:30:00.000Z",
    });

    await expect(
      verifyCsvExportCursor({ ...binding, cursor, now: createdAt, secret }),
    ).rejects.toThrow("CSV_EXPORT_CURSOR_INVALID");
  });
});
