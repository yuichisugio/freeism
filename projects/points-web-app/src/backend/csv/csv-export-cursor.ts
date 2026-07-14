const CURSOR_VERSION = 1;
const CURSOR_LIFETIME_MS = 30 * 60 * 1_000;

interface CursorBinding {
  exportId: string;
  filterHash: string;
  snapshotAt: string;
}

interface CreateCsvExportCursorInput extends CursorBinding {
  expiresAt?: string;
  nextOrdinal: number;
  now: string;
  secret: string;
}

interface VerifyCsvExportCursorInput extends CursorBinding {
  cursor: string;
  now: string;
  secret: string;
}

export interface CsvExportCursorPayload extends CursorBinding {
  version: 1;
  nextOrdinal: number;
  expiresAt: string;
}

export interface CsvExportCursorVerification {
  nextOrdinal: number;
  expiresAt: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function invalidCursor(): Error {
  return new Error("CSV_EXPORT_CURSOR_INVALID");
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw invalidCursor();
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw invalidCursor();
  }
}

function parseTime(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw invalidCursor();
  return timestamp;
}

function assertBinding(binding: CursorBinding): void {
  if (!binding.exportId || !binding.filterHash) throw invalidCursor();
  parseTime(binding.snapshotAt);
}

function assertOrdinal(nextOrdinal: number): void {
  if (!Number.isSafeInteger(nextOrdinal) || nextOrdinal < 0) throw invalidCursor();
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw invalidCursor();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

function isCursorPayload(value: unknown): value is CsvExportCursorPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.version === CURSOR_VERSION &&
    typeof payload.exportId === "string" &&
    typeof payload.filterHash === "string" &&
    typeof payload.snapshotAt === "string" &&
    typeof payload.nextOrdinal === "number" &&
    typeof payload.expiresAt === "string"
  );
}

export async function createCsvExportCursor(input: CreateCsvExportCursorInput): Promise<string> {
  assertBinding(input);
  assertOrdinal(input.nextOrdinal);
  const createdAt = parseTime(input.now);
  const maximumExpiresAt = createdAt + CURSOR_LIFETIME_MS;
  const expiresAt = input.expiresAt ? parseTime(input.expiresAt) : maximumExpiresAt;
  if (expiresAt <= createdAt || expiresAt > maximumExpiresAt) throw invalidCursor();
  const payload: CsvExportCursorPayload = {
    version: CURSOR_VERSION,
    exportId: input.exportId,
    nextOrdinal: input.nextOrdinal,
    filterHash: input.filterHash,
    snapshotAt: input.snapshotAt,
    expiresAt: input.expiresAt ?? new Date(expiresAt).toISOString(),
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(input.secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyCsvExportCursor(
  input: VerifyCsvExportCursorInput,
): Promise<CsvExportCursorVerification> {
  try {
    assertBinding(input);
    const now = parseTime(input.now);
    const parts = input.cursor.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw invalidCursor();
    const [encodedPayload, encodedSignature] = parts as [string, string];
    const key = await importHmacKey(input.secret);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!validSignature) throw invalidCursor();

    const payload: unknown = JSON.parse(decoder.decode(decodeBase64Url(encodedPayload)));
    if (!isCursorPayload(payload)) throw invalidCursor();
    assertBinding(payload);
    assertOrdinal(payload.nextOrdinal);
    const expiresAt = parseTime(payload.expiresAt);
    if (
      payload.exportId !== input.exportId ||
      payload.filterHash !== input.filterHash ||
      payload.snapshotAt !== input.snapshotAt
    ) {
      throw invalidCursor();
    }
    if (now >= expiresAt) throw new Error("CSV_EXPORT_CURSOR_EXPIRED");
    return { nextOrdinal: payload.nextOrdinal, expiresAt: payload.expiresAt };
  } catch (error) {
    if (error instanceof Error && error.message === "CSV_EXPORT_CURSOR_EXPIRED") throw error;
    throw invalidCursor();
  }
}
